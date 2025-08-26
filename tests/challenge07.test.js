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

describe("Challenge 07: Performance Optimization", () => {
	
	let authToken = null;
	let testUserId = null;
	let bulkTestProducts = [];

	beforeEach(async () => {
		// Create a test user and get auth token
		const userData = {
			firstName: "Performance",
			lastName: "Tester",
			email: "performance@example.com",
			password: "PerfPass123!"
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

		// Create a larger dataset for performance testing
		bulkTestProducts = [];
		const categories = ["electronics", "books", "clothing", "sports", "home", "beauty", "automotive"];
		
		for (let i = 1; i <= 100; i++) {
			const product = {
				name: `Performance Test Product ${i.toString().padStart(3, '0')}`,
				sku: `PERF-${i.toString().padStart(3, '0')}`,
				price: Math.floor(Math.random() * 1000) + 10,
				stockQuantity: Math.floor(Math.random() * 200) + 1,
				reorderLevel: Math.floor(Math.random() * 50) + 5,
				category: categories[i % categories.length],
				description: `This is a test product for performance testing. Product number ${i} with various attributes for comprehensive testing.`
			};

			const response = await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);

			expect(response.status).toBe(HttpStatus.CREATED);
			bulkTestProducts.push(response.body.data);
		}
	});

	// Challenge 8a: Database Query Optimization
	test("Challenge 7a-1: Efficient pagination and sorting", async () => {
		const startTime = Date.now();
		
		// Test large dataset pagination performance
		const paginationResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				page: 1,
				limit: 20,
				sortBy: "name",
				sortOrder: "asc"
			});

		const firstPageTime = Date.now() - startTime;
		
		expect(paginationResponse.status).toBe(HttpStatus.OK);
		expect(paginationResponse.body.data.length).toBe(20);
		expect(paginationResponse.body.pagination.total).toBe(100);
		expect(paginationResponse.body.pagination.totalPages).toBe(5);

		// Verify sorting is correct
		const products = paginationResponse.body.data;
		for (let i = 1; i < products.length; i++) {
			expect(products[i].name >= products[i-1].name).toBeTruthy();
		}

		// Test deeper pagination performance
		const deepPageStartTime = Date.now();
		const deepPageResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				page: 5,
				limit: 20,
				sortBy: "price",
				sortOrder: "desc"
			});

		const deepPageTime = Date.now() - deepPageStartTime;
		
		expect(deepPageResponse.status).toBe(HttpStatus.OK);
		expect(deepPageResponse.body.data.length).toBe(20);

		// Verify price sorting (descending)
		const deepPageProducts = deepPageResponse.body.data;
		for (let i = 1; i < deepPageProducts.length; i++) {
			expect(deepPageProducts[i].price <= deepPageProducts[i-1].price).toBeTruthy();
		}

		// Performance assertions
		expect(firstPageTime).toBeLessThan(1000); // Should complete within 1 second
		expect(deepPageTime).toBeLessThan(1500); // Deep pagination should still be reasonable

		// Test complex sorting with multiple criteria
		const complexSortResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				page: 1,
				limit: 50,
				sortBy: "category,price",
				sortOrder: "asc,desc"
			});

		expect(complexSortResponse.status).toBe(HttpStatus.OK);
		
		// Verify multi-column sorting
		const sortedProducts = complexSortResponse.body.data;
		for (let i = 1; i < sortedProducts.length; i++) {
			const current = sortedProducts[i];
			const previous = sortedProducts[i-1];
			
			if (current.category === previous.category) {
				// Same category: price should be descending
				expect(current.price <= previous.price).toBeTruthy();
			} else {
				// Different category: category should be ascending
				expect(current.category >= previous.category).toBeTruthy();
			}
		}
	});

	test("Challenge 7a-2: Search query optimization", async () => {
		// Test text search performance
		const searchStartTime = Date.now();
		const searchResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				q: "Test Product",
				limit: 50
			});

		const searchTime = Date.now() - searchStartTime;
		
		expect(searchResponse.status).toBe(HttpStatus.OK);
		expect(searchResponse.body.data.length).toBe(50); // Should find many matches
		
		// Performance assertion
		expect(searchTime).toBeLessThan(500); // Search should be fast

		// Test complex search with filters
		const complexSearchStartTime = Date.now();
		const complexSearchResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				q: "Performance",
				category: "electronics,books",
				minPrice: 50,
				maxPrice: 500,
				stockLevel: "normal",
				sortBy: "price",
				sortOrder: "asc",
				limit: 25
			});

		const complexSearchTime = Date.now() - complexSearchStartTime;
		
		expect(complexSearchResponse.status).toBe(HttpStatus.OK);
		
		// Verify all filters are applied
		complexSearchResponse.body.data.forEach(product => {
			expect(product.name.toLowerCase()).toContain("performance");
			expect(["electronics", "books"]).toContain(product.category);
			expect(product.price).toBeGreaterThanOrEqual(50);
			expect(product.price).toBeLessThanOrEqual(500);
			expect(product.stockQuantity).toBeGreaterThan(product.reorderLevel);
		});

		// Performance assertion for complex query
		expect(complexSearchTime).toBeLessThan(750);

		// Test wildcard and partial matching
		const wildcardSearchResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				q: "Prod*",
				limit: 30
			});

		expect(wildcardSearchResponse.status).toBe(HttpStatus.OK);
		expect(wildcardSearchResponse.body.data.length).toBe(30);

		// Test fuzzy search (handling typos)
		const fuzzySearchResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				q: "Performanc", // Missing 'e'
				fuzzy: true,
				limit: 20
			});

		expect(fuzzySearchResponse.status).toBe(HttpStatus.OK);
		expect(fuzzySearchResponse.body.data.length).toBeGreaterThan(0);
	});

	test("Challenge 7a-3: Database indexing effectiveness", async () => {
		// Test query performance with database indexes
		const indexedQueries = [
			{
				name: "SKU lookup",
				query: () => testSession
					.get("/api/product/sku/PERF-050")
					.set("Authorization", `Bearer ${authToken}`)
			},
			{
				name: "Category filtering",
				query: () => testSession
					.get("/api/product/filter")
					.set("Authorization", `Bearer ${authToken}`)
					.query({ category: "electronics" })
			},
			{
				name: "Price range query",
				query: () => testSession
					.get("/api/product/filter")
					.set("Authorization", `Bearer ${authToken}`)
					.query({ minPrice: 100, maxPrice: 300 })
			},
			{
				name: "User's products",
				query: () => testSession
					.get("/api/product")
					.set("Authorization", `Bearer ${authToken}`)
			}
		];

		for (const { name, query } of indexedQueries) {
			const startTime = Date.now();
			const response = await query();
			const queryTime = Date.now() - startTime;

			expect(response.status).toBe(HttpStatus.OK);
			
			// Performance assertion - indexed queries should be very fast
			expect(queryTime).toBeLessThan(200);
			
			console.log(`${name}: ${queryTime}ms`);
		}

		// Test compound index effectiveness
		const compoundIndexStartTime = Date.now();
		const compoundIndexResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				category: "electronics",
				minPrice: 200,
				sortBy: "stockQuantity",
				sortOrder: "desc"
			});

		const compoundIndexTime = Date.now() - compoundIndexStartTime;
		
		expect(compoundIndexResponse.status).toBe(HttpStatus.OK);
		expect(compoundIndexTime).toBeLessThan(300);

		// Verify database query plan analysis endpoint
		const queryPlanResponse = await testSession
			.get("/api/admin/query-performance")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				query: "product_search",
				analyze: true
			});

		// This endpoint might require admin access
		expect([HttpStatus.OK, HttpStatus.FORBIDDEN]).toContain(queryPlanResponse.status);
		
		if (queryPlanResponse.status === HttpStatus.OK) {
			expect(queryPlanResponse.body.data.executionTime).toBeDefined();
			expect(queryPlanResponse.body.data.indexesUsed).toBeDefined();
		}
	});

	// Challenge 8b: API Response Optimization
	test("Challenge 7b-1: Response compression and caching", async () => {
		// Test response compression
		const compressionResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.set("Accept-Encoding", "gzip, deflate, br")
			.query({ limit: 50 });

		expect(compressionResponse.status).toBe(HttpStatus.OK);
		
		// Check for compression headers
		const contentEncoding = compressionResponse.headers['content-encoding'];
		if (contentEncoding) {
			expect(['gzip', 'deflate', 'br']).toContain(contentEncoding);
		}

		// Test caching headers
		expect(compressionResponse.headers['cache-control']).toBeDefined();
		expect(compressionResponse.headers['etag']).toBeDefined();

		// Test conditional requests (304 Not Modified)
		const etag = compressionResponse.headers['etag'];
		const conditionalResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.set("If-None-Match", etag)
			.query({ limit: 50 });

		expect(conditionalResponse.status).toBe(HttpStatus.NOT_MODIFIED);

		// Test cache invalidation after data change
		const newProduct = {
			name: "Cache Invalidation Test",
			sku: "CACHE-INVALID-001",
			price: 99.99,
			category: "general"
		};

		await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(newProduct);

		// Subsequent request should return fresh data
		const freshResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.set("If-None-Match", etag)
			.query({ limit: 50 });

		expect(freshResponse.status).toBe(HttpStatus.OK);
		expect(freshResponse.body.data.length).toBe(50);
	});

	test("Challenge 7b-2: Efficient data serialization", async () => {
		// Test different response formats
		const formats = [
			{
				name: "JSON (default)",
				headers: { "Accept": "application/json" },
				contentType: "application/json"
			},
			{
				name: "JSON with minimal fields",
				headers: { "Accept": "application/json", "X-Fields": "id,name,sku,price" },
				contentType: "application/json"
			},
			{
				name: "Compact JSON",
				headers: { "Accept": "application/json", "X-Compact": "true" },
				contentType: "application/json"
			}
		];

		for (const format of formats) {
			const startTime = Date.now();
			const response = await testSession
				.get("/api/product/search")
				.set("Authorization", `Bearer ${authToken}`)
				.set(format.headers)
				.query({ limit: 100 });

			const responseTime = Date.now() - startTime;
			
			expect(response.status).toBe(HttpStatus.OK);
			expect(response.headers['content-type']).toContain(format.contentType);
			
			// Check response size efficiency
			const responseSize = JSON.stringify(response.body).length;
			console.log(`${format.name}: ${responseTime}ms, ${responseSize} bytes`);
			
			// Minimal fields should return smaller responses
			if (format.headers["X-Fields"]) {
				const product = response.body.data[0];
				const fields = Object.keys(product);
				expect(fields.length).toBeLessThanOrEqual(4);
				expect(fields).toContain("id");
				expect(fields).toContain("name");
				expect(fields).toContain("sku");
				expect(fields).toContain("price");
			}
		}

		// Test streaming for large datasets
		const streamingResponse = await testSession
			.get("/api/product/export")
			.set("Authorization", `Bearer ${authToken}`)
			.query({ format: "json-stream", limit: 100 });

		expect([HttpStatus.OK, HttpStatus.NOT_IMPLEMENTED]).toContain(streamingResponse.status);
		
		if (streamingResponse.status === HttpStatus.OK) {
			expect(streamingResponse.headers['content-type']).toContain('application/x-ndjson');
		}
	});

	// Challenge 8c: Memory and Resource Management
	test("Challenge 7c-1: Memory usage optimization", async () => {
		// Get initial memory baseline
		const initialMemoryResponse = await testSession
			.get("/api/admin/system-stats")
			.set("Authorization", `Bearer ${authToken}`);

		expect([HttpStatus.OK, HttpStatus.FORBIDDEN]).toContain(initialMemoryResponse.status);
		
		let initialMemory = 0;
		if (initialMemoryResponse.status === HttpStatus.OK) {
			initialMemory = initialMemoryResponse.body.data.memoryUsage.used;
		}

		// Perform memory-intensive operations
		const intensiveOperations = [];
		for (let i = 0; i < 10; i++) {
			intensiveOperations.push(
				testSession
					.get("/api/product/search")
					.set("Authorization", `Bearer ${authToken}`)
					.query({ 
						page: i + 1, 
						limit: 50,
						sortBy: "name",
						includeDetails: true
					})
			);
		}

		const startTime = Date.now();
		const responses = await Promise.all(intensiveOperations);
		const totalTime = Date.now() - startTime;

		// Verify all operations completed successfully
		responses.forEach(response => {
			expect(response.status).toBe(HttpStatus.OK);
		});

		// Check memory usage after operations
		const finalMemoryResponse = await testSession
			.get("/api/admin/system-stats")
			.set("Authorization", `Bearer ${authToken}`);

		if (finalMemoryResponse.status === HttpStatus.OK) {
			const finalMemory = finalMemoryResponse.body.data.memoryUsage.used;
			const memoryIncrease = finalMemory - initialMemory;
			
			// Memory increase should be reasonable
			expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
		}

		// Performance assertion
		expect(totalTime).toBeLessThan(5000); // 10 concurrent operations in under 5 seconds

		// Test garbage collection trigger
		const gcResponse = await testSession
			.post("/api/admin/system/gc")
			.set("Authorization", `Bearer ${authToken}`);

		expect([HttpStatus.OK, HttpStatus.FORBIDDEN]).toContain(gcResponse.status);
	});

	test("Challenge 7c-2: Connection pooling and resource cleanup", async () => {
		// Test database connection pooling under load
		const connectionPoolTest = async () => {
			const promises = [];
			for (let i = 0; i < 20; i++) {
				promises.push(
					testSession
						.get("/api/product/filter")
						.set("Authorization", `Bearer ${authToken}`)
						.query({ 
							category: "electronics",
							page: (i % 3) + 1,
							limit: 10
						})
				);
			}
			return await Promise.all(promises);
		};

		const startTime = Date.now();
		const poolTestResponses = await connectionPoolTest();
		const poolTestTime = Date.now() - startTime;

		// All requests should succeed
		poolTestResponses.forEach(response => {
			expect(response.status).toBe(HttpStatus.OK);
		});

		// Should handle concurrent connections efficiently
		expect(poolTestTime).toBeLessThan(3000);

		// Test connection pool statistics
		const poolStatsResponse = await testSession
			.get("/api/admin/database/pool-stats")
			.set("Authorization", `Bearer ${authToken}`);

		expect([HttpStatus.OK, HttpStatus.FORBIDDEN]).toContain(poolStatsResponse.status);

		if (poolStatsResponse.status === HttpStatus.OK) {
			const poolStats = poolStatsResponse.body.data;
			expect(poolStats.totalConnections).toBeDefined();
			expect(poolStats.activeConnections).toBeDefined();
			expect(poolStats.idleConnections).toBeDefined();
			expect(poolStats.pendingConnections).toBeDefined();
			
			// Pool should not be exhausted
			expect(poolStats.pendingConnections).toBe(0);
		}

		// Test resource cleanup after large operations
		const largeOperationResponse = await testSession
			.get("/api/product/export")
			.set("Authorization", `Bearer ${authToken}`)
			.query({ format: "csv" });

		expect(largeOperationResponse.status).toBe(HttpStatus.OK);

		// Verify resources are cleaned up properly
		const cleanupStatsResponse = await testSession
			.get("/api/admin/system-stats")
			.set("Authorization", `Bearer ${authToken}`);

		if (cleanupStatsResponse.status === HttpStatus.OK) {
			const stats = cleanupStatsResponse.body.data;
			expect(stats.openFileDescriptors).toBeLessThan(1000);
			expect(stats.databaseConnections.active).toBeLessThan(10);
		}
	});

	// Challenge 8d: Scalability Testing
	test("Challenge 7d-1: Load testing and performance benchmarks", async () => {
		// Simulate realistic load patterns
		const loadTests = [
			{
				name: "Read-heavy load",
				operations: () => {
					const promises = [];
					for (let i = 0; i < 50; i++) {
						promises.push(
							testSession
								.get("/api/product/search")
								.set("Authorization", `Bearer ${authToken}`)
								.query({ 
									page: (i % 5) + 1,
									limit: 20,
									sortBy: ["name", "price", "stockQuantity"][i % 3]
								})
						);
					}
					return Promise.all(promises);
				}
			},
			{
				name: "Mixed read-write load",
				operations: async () => {
					const promises = [];
					
					// 80% reads
					for (let i = 0; i < 40; i++) {
						promises.push(
							testSession
								.get("/api/product/search")
								.set("Authorization", `Bearer ${authToken}`)
								.query({ page: (i % 3) + 1, limit: 10 })
						);
					}
					
					// 20% writes
					for (let i = 0; i < 10; i++) {
						promises.push(
							testSession
								.put(`/api/product/${bulkTestProducts[i].id}/stock`)
								.set("Authorization", `Bearer ${authToken}`)
								.send({ quantity: 1, operation: "add" })
						);
					}
					
					return Promise.all(promises);
				}
			}
		];

		for (const { name, operations } of loadTests) {
			const startTime = Date.now();
			const responses = await operations();
			const loadTestTime = Date.now() - startTime;

			// Calculate success rate
			const successfulResponses = responses.filter(r => r.status < 400);
			const successRate = (successfulResponses.length / responses.length) * 100;

			console.log(`${name}: ${loadTestTime}ms, ${successRate}% success rate`);

			// Performance assertions
			expect(successRate).toBeGreaterThanOrEqual(95); // At least 95% success rate
			expect(loadTestTime).toBeLessThan(10000); // Complete within 10 seconds

			// Calculate average response time
			const responseTimes = responses.map((_, index) => {
				// This is a simplified calculation
				return loadTestTime / responses.length;
			});
			const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
			
			expect(avgResponseTime).toBeLessThan(500); // Average response under 500ms
		}

		// Test sustained load over time
		const sustainedLoadTest = async () => {
			const iterations = 5;
			const responseTimes = [];

			for (let i = 0; i < iterations; i++) {
				const iterationStart = Date.now();
				
				const promises = [];
				for (let j = 0; j < 20; j++) {
					promises.push(
						testSession
							.get("/api/product/search")
							.set("Authorization", `Bearer ${authToken}`)
							.query({ page: j % 3 + 1, limit: 15 })
					);
				}
				
				const responses = await Promise.all(promises);
				const iterationTime = Date.now() - iterationStart;
				responseTimes.push(iterationTime);

				// All should succeed
				responses.forEach(response => {
					expect(response.status).toBe(HttpStatus.OK);
				});

				// Brief pause between iterations
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			// Verify consistent performance (no significant degradation)
			const firstHalf = responseTimes.slice(0, Math.floor(iterations / 2));
			const secondHalf = responseTimes.slice(Math.floor(iterations / 2));
			
			const firstHalfAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
			const secondHalfAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;
			
			// Performance should not degrade significantly over time
			expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);
		};

		await sustainedLoadTest();
	});

	test("Challenge 7d-2: Rate limiting and throttling", async () => {
		// Test rate limiting enforcement
		const rapidRequests = [];
		for (let i = 0; i < 100; i++) {
			rapidRequests.push(
				testSession
					.get("/api/product/search")
					.set("Authorization", `Bearer ${authToken}`)
					.query({ page: 1, limit: 5 })
			);
		}

		const startTime = Date.now();
		const responses = await Promise.all(rapidRequests);
		const totalTime = Date.now() - startTime;

		// Count successful and rate-limited responses
		const successfulResponses = responses.filter(r => r.status === HttpStatus.OK);
		const rateLimitedResponses = responses.filter(r => r.status === HttpStatus.TOO_MANY_REQUESTS);

		console.log(`Rapid requests: ${successfulResponses.length} successful, ${rateLimitedResponses.length} rate limited`);

		// Rate limiting should kick in for excessive requests
		if (rateLimitedResponses.length > 0) {
			expect(rateLimitedResponses[0].headers['retry-after']).toBeDefined();
			expect(rateLimitedResponses[0].headers['x-ratelimit-limit']).toBeDefined();
			expect(rateLimitedResponses[0].headers['x-ratelimit-remaining']).toBeDefined();
		}

		// Test adaptive throttling
		const throttlingResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({ 
				page: 1, 
				limit: 100, // Large request
				includeDetails: true 
			});

		expect([HttpStatus.OK, HttpStatus.TOO_MANY_REQUESTS]).toContain(throttlingResponse.status);

		if (throttlingResponse.status === HttpStatus.OK) {
			// Large requests should take longer (throttled)
			expect(throttlingResponse.headers['x-response-time']).toBeDefined();
		}

		// Test rate limit recovery
		await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for rate limit reset

		const recoveryResponse = await testSession
			.get("/api/product/search")
			.set("Authorization", `Bearer ${authToken}`)
			.query({ page: 1, limit: 10 });

		expect(recoveryResponse.status).toBe(HttpStatus.OK);

		// Test different rate limits for different endpoints
		const adminEndpointResponse = await testSession
			.get("/api/admin/system-stats")
			.set("Authorization", `Bearer ${authToken}`);

		// Admin endpoints might have different rate limits
		expect([HttpStatus.OK, HttpStatus.FORBIDDEN, HttpStatus.TOO_MANY_REQUESTS]).toContain(adminEndpointResponse.status);
	});
});
