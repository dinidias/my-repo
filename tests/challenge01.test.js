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

describe("Challenge 02: Advanced Filtering and Sorting", () => {
	
	let authToken = null;
	let testUserId = null;

	beforeEach(async () => {
		// Create a test user and get auth token
		const userData = {
			firstName: "Filter",
			lastName: "Tester",
			email: "filter@example.com",
			password: "FilterPass123!"
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

	// Challenge 2a: Advanced Filtering
	test("Challenge 2a-1: Product filtering by category", async () => {
		// Create multiple products with different categories
		const products = [
			{ name: "iPhone 14", sku: "IPHONE-14", price: 999.99, category: "electronics", stockQuantity: 50 },
			{ name: "Samsung Galaxy", sku: "SAMSUNG-S23", price: 899.99, category: "electronics", stockQuantity: 30 },
			{ name: "Programming Book", sku: "BOOK-001", price: 49.99, category: "books", stockQuantity: 100 },
			{ name: "Cooking Book", sku: "BOOK-002", price: 29.99, category: "books", stockQuantity: 75 }
		];

		for (const product of products) {
			await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);
		}

		// Test category filtering - electronics
		const electronicsFilter = await testSession
			.get("/api/product?category=electronics")
			.set("Authorization", `Bearer ${authToken}`);

		expect(electronicsFilter.status).toBe(HttpStatus.OK);
		expect(electronicsFilter.body.data.length).toBe(2);
		expect(electronicsFilter.body.data.every(p => p.category === "electronics")).toBeTruthy();

		// Test category filtering - books
		const booksFilter = await testSession
			.get("/api/product?category=books")
			.set("Authorization", `Bearer ${authToken}`);

		expect(booksFilter.status).toBe(HttpStatus.OK);
		expect(booksFilter.body.data.length).toBe(2);
		expect(booksFilter.body.data.every(p => p.category === "books")).toBeTruthy();
	});

	test("Challenge 2a-2: Product filtering by price range", async () => {
		// Create products with different price ranges
		const products = [
			{ name: "Expensive Phone", sku: "EXPENSIVE-001", price: 1200.00, category: "electronics", stockQuantity: 10 },
			{ name: "Mid-range Phone", sku: "MID-001", price: 600.00, category: "electronics", stockQuantity: 25 },
			{ name: "Budget Phone", sku: "BUDGET-001", price: 200.00, category: "electronics", stockQuantity: 50 },
			{ name: "Cheap Book", sku: "CHEAP-BOOK", price: 15.99, category: "books", stockQuantity: 100 }
		];

		for (const product of products) {
			await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);
		}

		// Test price range filtering - $500-$1000
		const midRangeFilter = await testSession
			.get("/api/product?minPrice=500&maxPrice=1000")
			.set("Authorization", `Bearer ${authToken}`);

		expect(midRangeFilter.status).toBe(HttpStatus.OK);
		expect(midRangeFilter.body.data.length).toBe(1);
		expect(midRangeFilter.body.data[0].name).toBe("Mid-range Phone");

		// Test minimum price filtering
		const minPriceFilter = await testSession
			.get("/api/product?minPrice=200")
			.set("Authorization", `Bearer ${authToken}`);

		expect(minPriceFilter.status).toBe(HttpStatus.OK);
		expect(minPriceFilter.body.data.length).toBe(3); // All except the cheap book
		expect(minPriceFilter.body.data.every(p => p.price >= 200)).toBeTruthy();

		// Test maximum price filtering
		const maxPriceFilter = await testSession
			.get("/api/product?maxPrice=600")
			.set("Authorization", `Bearer ${authToken}`);

		expect(maxPriceFilter.status).toBe(HttpStatus.OK);
		expect(maxPriceFilter.body.data.length).toBe(3); // All except expensive phone
		expect(maxPriceFilter.body.data.every(p => p.price <= 600)).toBeTruthy();
	});

	test("Challenge 2a-3: Product search functionality", async () => {
		// Create products with searchable content
		const products = [
			{ name: "iPhone 14 Pro Max", sku: "IPHONE-14-PRO", price: 999.99, category: "electronics", description: "Latest Apple smartphone" },
			{ name: "Samsung Galaxy S23", sku: "SAMSUNG-S23", price: 899.99, category: "electronics", description: "Android flagship phone" },
			{ name: "JavaScript Guide", sku: "JS-BOOK", price: 49.99, category: "books", description: "Learn JavaScript programming" },
			{ name: "Python Cookbook", sku: "PY-BOOK", price: 59.99, category: "books", description: "Python programming recipes" }
		];

		for (const product of products) {
			await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);
		}

		// Test search by name
		const nameSearch = await testSession
			.get("/api/product?search=iPhone")
			.set("Authorization", `Bearer ${authToken}`);

		expect(nameSearch.status).toBe(HttpStatus.OK);
		expect(nameSearch.body.data.length).toBe(1);
		expect(nameSearch.body.data[0].name).toContain("iPhone");

		// Test search by description
		const descriptionSearch = await testSession
			.get("/api/product?search=programming")
			.set("Authorization", `Bearer ${authToken}`);

		expect(descriptionSearch.status).toBe(HttpStatus.OK);
		expect(descriptionSearch.body.data.length).toBe(2); // Both programming books
		expect(descriptionSearch.body.data.every(p => p.description.toLowerCase().includes("programming"))).toBeTruthy();

		// Test search by SKU
		const skuSearch = await testSession
			.get("/api/product?search=JS-BOOK")
			.set("Authorization", `Bearer ${authToken}`);

		expect(skuSearch.status).toBe(HttpStatus.OK);
		expect(skuSearch.body.data.length).toBe(1);
		expect(skuSearch.body.data[0].sku).toBe("JS-BOOK");
	});

	// Challenge 2b: Advanced Sorting
	test("Challenge 2b-1: Product sorting by different fields", async () => {
		// Create products with different values
		const products = [
			{ name: "Product Z", sku: "SORT-003", price: 150.00, category: "electronics", stockQuantity: 10 },
			{ name: "Product A", sku: "SORT-001", price: 100.00, category: "books", stockQuantity: 50 },
			{ name: "Product M", sku: "SORT-002", price: 200.00, category: "electronics", stockQuantity: 25 }
		];

		for (const product of products) {
			await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);
		}

		// Test sorting by name (ascending)
		const nameSortAsc = await testSession
			.get("/api/product?sortBy=name&sortOrder=asc")
			.set("Authorization", `Bearer ${authToken}`);

		expect(nameSortAsc.status).toBe(HttpStatus.OK);
		expect(nameSortAsc.body.data[0].name).toBe("Product A");
		expect(nameSortAsc.body.data[1].name).toBe("Product M");
		expect(nameSortAsc.body.data[2].name).toBe("Product Z");

		// Test sorting by price (descending)
		const priceSortDesc = await testSession
			.get("/api/product?sortBy=price&sortOrder=desc")
			.set("Authorization", `Bearer ${authToken}`);

		expect(priceSortDesc.status).toBe(HttpStatus.OK);
		expect(priceSortDesc.body.data[0].price).toBe(200.00);
		expect(priceSortDesc.body.data[1].price).toBe(150.00);
		expect(priceSortDesc.body.data[2].price).toBe(100.00);

		// Test sorting by stock quantity (ascending)
		const stockSortAsc = await testSession
			.get("/api/product?sortBy=stockQuantity&sortOrder=asc")
			.set("Authorization", `Bearer ${authToken}`);

		expect(stockSortAsc.status).toBe(HttpStatus.OK);
		expect(stockSortAsc.body.data[0].stockQuantity).toBe(10);
		expect(stockSortAsc.body.data[1].stockQuantity).toBe(25);
		expect(stockSortAsc.body.data[2].stockQuantity).toBe(50);
	});

	test("Challenge 2b-2: Pagination with sorting", async () => {
		// Create multiple products
		const products = [];
		for (let i = 1; i <= 15; i++) {
			products.push({
				name: `Product ${i.toString().padStart(2, '0')}`,
				sku: `PAGE-${i.toString().padStart(3, '0')}`,
				price: i * 10,
				category: "electronics",
				stockQuantity: i * 5
			});
		}

		for (const product of products) {
			await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);
		}

		// Test first page with 5 items per page, sorted by price
		const page1 = await testSession
			.get("/api/product?page=1&limit=5&sortBy=price&sortOrder=asc")
			.set("Authorization", `Bearer ${authToken}`);

		expect(page1.status).toBe(HttpStatus.OK);
		expect(page1.body.data.length).toBe(5);
		expect(page1.body.data[0].price).toBe(10); // Lowest price
		expect(page1.body.data[4].price).toBe(50);

		// Test second page
		const page2 = await testSession
			.get("/api/product?page=2&limit=5&sortBy=price&sortOrder=asc")
			.set("Authorization", `Bearer ${authToken}`);

		expect(page2.status).toBe(HttpStatus.OK);
		expect(page2.body.data.length).toBe(5);
		expect(page2.body.data[0].price).toBe(60); // Next price range
		expect(page2.body.data[4].price).toBe(100);

		// Test third page
		const page3 = await testSession
			.get("/api/product?page=3&limit=5&sortBy=price&sortOrder=asc")
			.set("Authorization", `Bearer ${authToken}`);

		expect(page3.status).toBe(HttpStatus.OK);
		expect(page3.body.data.length).toBe(5);
		expect(page3.body.data[0].price).toBe(110); // Final price range
		expect(page3.body.data[4].price).toBe(150);
	});

	test("Challenge 2b-3: Combined filtering and sorting", async () => {
		// Create products with mixed attributes
		const products = [
			{ name: "High-end Phone", sku: "PHONE-001", price: 1000.00, category: "electronics", stockQuantity: 15 },
			{ name: "Budget Phone", sku: "PHONE-002", price: 300.00, category: "electronics", stockQuantity: 40 },
			{ name: "Tablet", sku: "TABLET-001", price: 800.00, category: "electronics", stockQuantity: 20 },
			{ name: "Programming Book", sku: "BOOK-001", price: 60.00, category: "books", stockQuantity: 100 },
			{ name: "Fiction Novel", sku: "BOOK-002", price: 25.00, category: "books", stockQuantity: 75 }
		];

		for (const product of products) {
			await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);
		}

		// Test: Filter by category and sort by price
		const electronicsFilterSorted = await testSession
			.get("/api/product?category=electronics&sortBy=price&sortOrder=desc")
			.set("Authorization", `Bearer ${authToken}`);

		expect(electronicsFilterSorted.status).toBe(HttpStatus.OK);
		expect(electronicsFilterSorted.body.data.length).toBe(3);
		expect(electronicsFilterSorted.body.data[0].price).toBe(1000.00); // High-end phone first
		expect(electronicsFilterSorted.body.data[1].price).toBe(800.00);  // Tablet second
		expect(electronicsFilterSorted.body.data[2].price).toBe(300.00);  // Budget phone last

		// Test: Filter by price range and category, then sort by stock
		const complexFilter = await testSession
			.get("/api/product?category=electronics&minPrice=500&sortBy=stockQuantity&sortOrder=asc")
			.set("Authorization", `Bearer ${authToken}`);

		expect(complexFilter.status).toBe(HttpStatus.OK);
		expect(complexFilter.body.data.length).toBe(2); // High-end phone and tablet
		expect(complexFilter.body.data[0].stockQuantity).toBe(15); // High-end phone (lower stock)
		expect(complexFilter.body.data[1].stockQuantity).toBe(20); // Tablet (higher stock)

		// Test: Search with category filter and sorting
		const searchFilterSort = await testSession
			.get("/api/product?search=phone&category=electronics&sortBy=price&sortOrder=asc")
			.set("Authorization", `Bearer ${authToken}`);

		expect(searchFilterSort.status).toBe(HttpStatus.OK);
		expect(searchFilterSort.body.data.length).toBe(2); // Both phones
		expect(searchFilterSort.body.data[0].price).toBe(300.00); // Budget phone first
		expect(searchFilterSort.body.data[1].price).toBe(1000.00); // High-end phone second
	});
});
