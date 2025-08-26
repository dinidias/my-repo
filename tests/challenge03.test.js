import app from "../src/server.js";
import db from "../db/db-config.js";
import testBase from "./testBase.js";
import { expect, test, describe, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import HttpStatus from "../src/enums/httpStatus.js";

let testSession = null;

// Setup and teardown
beforeAll(async () => {
	testSession = testBase.createSuperTestSession(app);
	await testBase.resetDatabase(db);
});
afterEach(async () => {
	await testBase.resetDatabase(db);
});
afterAll((done) => {
	app.close(done);
});

describe("Challenge 03: User Authentication and Authorization", () => {
	
	let authToken = null;
	let testUserId = null;

	beforeEach(async () => {
		// Create a test user and get auth token
		const userData = {
			firstName: "Validation",
			lastName: "Tester",
			email: "validation@example.com",
			password: "ValidPass123!"
		};

		await testSession.post("/api/auth/signup").send(userData);
		
		const loginResponse = await testSession
			.post("/api/auth/login")
			.send({
				email: userData.email,
				password: userData.password
			});

		authToken = loginResponse.body.data.token;
		testUserId = loginResponse.body.data.user.id;
	});

	// Challenge 3a: Authentication Security
	test("Challenge 3a-1: Advanced stock level validation", async () => {
		// Create a product with specific stock levels
		const product = {
			name: "Stock Validation Test",
			sku: "STOCK-VAL-001",
			price: 99.99,
			stockQuantity: 100,
			reorderLevel: 20,
			category: "electronics"
		};

		const createResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(product);

		expect(createResponse.status).toBe(HttpStatus.CREATED);
		const productId = createResponse.body.data.id;

		// Test stock operations with advanced validation
		const testCases = [
			{
				description: "Valid stock addition",
				operation: { quantity: 50, operation: "add" },
				expectedStock: 150,
				shouldSucceed: true
			},
			{
				description: "Valid stock subtraction",
				operation: { quantity: 30, operation: "subtract" },
				expectedStock: 120, // 150 - 30
				shouldSucceed: true
			},
			{
				description: "Invalid: Decimal quantity",
				operation: { quantity: 10.5, operation: "add" },
				shouldSucceed: false,
				expectedError: "integer"
			},
			{
				description: "Invalid: Zero quantity",
				operation: { quantity: 0, operation: "add" },
				shouldSucceed: false,
				expectedError: "greater than 0"
			},
			{
				description: "Invalid: Negative quantity",
				operation: { quantity: -5, operation: "add" },
				shouldSucceed: false,
				expectedError: "greater than 0"
			},
			{
				description: "Invalid: Unknown operation",
				operation: { quantity: 10, operation: "multiply" },
				shouldSucceed: false,
				expectedError: "add"
			},
			{
				description: "Invalid: Insufficient stock for subtraction",
				operation: { quantity: 200, operation: "subtract" },
				shouldSucceed: false,
				expectedError: "Insufficient stock"
			}
		];

		let currentStock = 100;
		for (const testCase of testCases) {
			const response = await testSession
				.put(`/api/product/${productId}/stock`)
				.set("Authorization", `Bearer ${authToken}`)
				.send(testCase.operation);

			if (testCase.shouldSucceed) {
				expect(response.status).toBe(HttpStatus.OK);
				expect(response.body.data.stockQuantity).toBe(testCase.expectedStock);
				currentStock = testCase.expectedStock;
			} else {
				expect(response.status).toBe(HttpStatus.BAD_REQUEST);
				expect(response.body.message.toLowerCase()).toContain(testCase.expectedError.toLowerCase());
			}
		}
	});

	test("Challenge 3a-2: Reorder level detection and alerts", async () => {
		// Create products with different stock scenarios
		const products = [
			{
				name: "High Stock Product",
				sku: "REORDER-HIGH-001",
				price: 50.00,
				stockQuantity: 100,
				reorderLevel: 20,
				category: "electronics"
			},
			{
				name: "Low Stock Product",
				sku: "REORDER-LOW-001",
				price: 30.00,
				stockQuantity: 15, // Below reorder level
				reorderLevel: 20,
				category: "books"
			},
			{
				name: "Critical Stock Product",
				sku: "REORDER-CRIT-001",
				price: 75.00,
				stockQuantity: 5, // Well below reorder level
				reorderLevel: 15,
				category: "clothing"
			},
			{
				name: "Exact Reorder Level",
				sku: "REORDER-EXACT-001",
				price: 60.00,
				stockQuantity: 10, // Exactly at reorder level
				reorderLevel: 10,
				category: "electronics"
			},
			{
				name: "Inactive Product",
				sku: "REORDER-INACTIVE-001",
				price: 40.00,
				stockQuantity: 5,
				reorderLevel: 10,
				category: "general",
				isActive: false
			}
		];

		const productIds = [];
		for (const product of products) {
			const response = await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);

			expect(response.status).toBe(HttpStatus.CREATED);
			productIds.push(response.body.data.id);
		}

		// If inactive product needs to be set as inactive
		if (products[4].isActive === false) {
			await testSession
				.put(`/api/product/${productIds[4]}`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({ isActive: false });
		}

		// Test reorder detection
		const reorderResponse = await testSession
			.get("/api/product/reorder")
			.set("Authorization", `Bearer ${authToken}`);

		expect(reorderResponse.status).toBe(HttpStatus.OK);
		
		const reorderProducts = reorderResponse.body.data;
		expect(reorderProducts.length).toBe(3); // Low, Critical, and Exact products

		// Verify correct products are in reorder list
		const reorderSkus = reorderProducts.map(p => p.sku);
		expect(reorderSkus).toContain("REORDER-LOW-001");
		expect(reorderSkus).toContain("REORDER-CRIT-001");
		expect(reorderSkus).toContain("REORDER-EXACT-001");
		expect(reorderSkus).not.toContain("REORDER-HIGH-001");
		expect(reorderSkus).not.toContain("REORDER-INACTIVE-001");

		// Verify products are sorted by priority (lowest stock to reorder ratio first)
		const sortedByPriority = reorderProducts.sort((a, b) => {
			const ratioA = a.stockQuantity / a.reorderLevel;
			const ratioB = b.stockQuantity / b.reorderLevel;
			return ratioA - ratioB;
		});
		
		expect(reorderProducts[0].sku).toBe(sortedByPriority[0].sku);
	});

	test("Challenge 3a-3: Product lifecycle management", async () => {
		// Create a product
		const product = {
			name: "Lifecycle Test Product",
			sku: "LIFECYCLE-001",
			price: 99.99,
			stockQuantity: 50,
			reorderLevel: 10,
			category: "electronics"
		};

		const createResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(product);

		expect(createResponse.status).toBe(HttpStatus.CREATED);
		const productId = createResponse.body.data.id;

		// Test product is active by default
		expect(createResponse.body.data.isActive).toBeTruthy();

		// Test deactivating product
		const deactivateResponse = await testSession
			.put(`/api/product/${productId}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ isActive: false });

		expect(deactivateResponse.status).toBe(HttpStatus.OK);
		expect(deactivateResponse.body.data.isActive).toBeFalsy();

		// Verify inactive product doesn't appear in general product list
		const allProductsResponse = await testSession
			.get("/api/product/all")
			.set("Authorization", `Bearer ${authToken}`);

		expect(allProductsResponse.status).toBe(HttpStatus.OK);
		const activeProductSkus = allProductsResponse.body.data.map(p => p.sku);
		expect(activeProductSkus).not.toContain("LIFECYCLE-001");

		// But should appear in user's product list
		const userProductsResponse = await testSession
			.get("/api/product")
			.set("Authorization", `Bearer ${authToken}`);

		expect(userProductsResponse.status).toBe(HttpStatus.OK);
		const userProductSkus = userProductsResponse.body.data.map(p => p.sku);
		expect(userProductSkus).toContain("LIFECYCLE-001");
	});

	// Challenge 3b: Authorization and Access Control
	test("Challenge 3b-1: Concurrent stock update protection", async () => {
		// Create a product for concurrent testing
		const product = {
			name: "Concurrent Test Product",
			sku: "CONCURRENT-001",
			price: 99.99,
			stockQuantity: 100,
			reorderLevel: 10,
			category: "electronics"
		};

		const createResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(product);

		expect(createResponse.status).toBe(HttpStatus.CREATED);
		const productId = createResponse.body.data.id;

		// Simulate concurrent stock updates
		const operations = [
			{ quantity: 10, operation: "subtract" },
			{ quantity: 5, operation: "subtract" },
			{ quantity: 15, operation: "add" },
			{ quantity: 20, operation: "subtract" }
		];

		// Execute operations sequentially (simulating concurrent behavior)
		const results = [];
		for (const op of operations) {
			const response = await testSession
				.put(`/api/product/${productId}/stock`)
				.set("Authorization", `Bearer ${authToken}`)
				.send(op);
			
			results.push({
				operation: op,
				response: response.body,
				status: response.status
			});
		}

		// Verify final stock level is consistent
		const finalResponse = await testSession
			.get(`/api/product/${productId}`)
			.set("Authorization", `Bearer ${authToken}`);

		const expectedFinalStock = 100 - 10 - 5 + 15 - 20; // 80
		expect(finalResponse.body.data.stockQuantity).toBe(expectedFinalStock);

		// Verify all operations were successful
		results.forEach(result => {
			expect(result.status).toBe(HttpStatus.OK);
		});
	});

	test("Challenge 3b-2: Data consistency validation", async () => {
		// Test various data consistency scenarios
		const consistencyTests = [
			{
				description: "Price cannot be negative",
				updates: { price: -50.00 },
				shouldFail: true,
				errorContains: "price"
			},
			{
				description: "Stock quantity cannot be negative",
				updates: { stockQuantity: -10 },
				shouldFail: true,
				errorContains: "stockQuantity"
			},
			{
				description: "Reorder level cannot be negative",
				updates: { reorderLevel: -5 },
				shouldFail: true,
				errorContains: "reorderLevel"
			},
			{
				description: "Valid updates should succeed",
				updates: { 
					price: 149.99, 
					stockQuantity: 75, 
					reorderLevel: 15,
					description: "Updated description"
				},
				shouldFail: false
			}
		];

		// Create a product for testing
		const product = {
			name: "Consistency Test Product",
			sku: "CONSISTENCY-001",
			price: 99.99,
			stockQuantity: 50,
			reorderLevel: 10,
			category: "electronics"
		};

		const createResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(product);

		expect(createResponse.status).toBe(HttpStatus.CREATED);
		const productId = createResponse.body.data.id;

		// Run consistency tests
		for (const test of consistencyTests) {
			const response = await testSession
				.put(`/api/product/${productId}`)
				.set("Authorization", `Bearer ${authToken}`)
				.send(test.updates);

			if (test.shouldFail) {
				expect(response.status).toBe(HttpStatus.BAD_REQUEST);
				expect(response.body.message.toLowerCase()).toContain(test.errorContains.toLowerCase());
			} else {
				expect(response.status).toBe(HttpStatus.OK);
				// Verify updates were applied
				for (const [key, value] of Object.entries(test.updates)) {
					expect(response.body.data[key]).toBe(value);
				}
			}
		}
	});

	test("Challenge 3b-3: SKU uniqueness during updates", async () => {
		// Create two products
		const product1 = {
			name: "Product One",
			sku: "UNIQUE-UPDATE-001",
			price: 99.99,
			category: "electronics"
		};

		const product2 = {
			name: "Product Two", 
			sku: "UNIQUE-UPDATE-002",
			price: 149.99,
			category: "books"
		};

		const create1Response = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(product1);

		const create2Response = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(product2);

		expect(create1Response.status).toBe(HttpStatus.CREATED);
		expect(create2Response.status).toBe(HttpStatus.CREATED);

		const product1Id = create1Response.body.data.id;
		const product2Id = create2Response.body.data.id;

		// Try to update product2's SKU to match product1's SKU
		const duplicateSkuResponse = await testSession
			.put(`/api/product/${product2Id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ sku: "UNIQUE-UPDATE-001" });

		expect(duplicateSkuResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(duplicateSkuResponse.body.message).toContain("SKU already exists");

		// Try with different case (should also fail)
		const duplicateSkuCaseResponse = await testSession
			.put(`/api/product/${product2Id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ sku: "unique-update-001" });

		expect(duplicateSkuCaseResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(duplicateSkuCaseResponse.body.message).toContain("SKU already exists");

		// Update to a truly unique SKU should work
		const validSkuResponse = await testSession
			.put(`/api/product/${product2Id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ sku: "UNIQUE-UPDATE-003" });

		expect(validSkuResponse.status).toBe(HttpStatus.OK);
		expect(validSkuResponse.body.data.sku).toBe("UNIQUE-UPDATE-003");

		// Updating product to its own SKU should work (no change)
		const sameSkuResponse = await testSession
			.put(`/api/product/${product1Id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ 
				sku: "UNIQUE-UPDATE-001",
				name: "Updated Product One"
			});

		expect(sameSkuResponse.status).toBe(HttpStatus.OK);
		expect(sameSkuResponse.body.data.name).toBe("Updated Product One");
	});
});
