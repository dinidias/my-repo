import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
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

describe("Challenge 10: Frontend Validation and API Design", () => {
	
	let authToken = null;
	let testUserId = null;
	let apiTestProducts = [];

	beforeEach(async () => {
		// Create a test user and get auth token
		const userData = {
			firstName: "API",
			lastName: "Tester",
			email: "api@example.com",
			password: "ApiPass123!"
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

		// Create test products for API testing
		const products = [
			{
				name: "API Test Product 1",
				sku: "API-PROD-001",
				price: 99.99,
				stockQuantity: 100,
				reorderLevel: 20,
				category: "electronics"
			},
			{
				name: "API Test Product 2",
				sku: "API-PROD-002",
				price: 149.99,
				stockQuantity: 50,
				reorderLevel: 10,
				category: "books"
			},
			{
				name: "API Test Product 3",
				sku: "API-PROD-003",
				price: 79.99,
				stockQuantity: 200,
				reorderLevel: 30,
				category: "clothing"
			}
		];

		apiTestProducts = [];
		for (const product of products) {
			const response = await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);

			expect(response.status).toBe(HttpStatus.CREATED);
			apiTestProducts.push(response.body.data);
		}
	});

	// Challenge 10a: Frontend Bug Fixes
	test("Challenge 10a-1: Fix form ID mismatches and input type bugs", async () => {
		// Test login.html form ID issue
		const loginHtmlPath = path.join(process.cwd(), 'client', 'login.html');
		const loginHtmlContent = fs.readFileSync(loginHtmlPath, 'utf8');
		const loginDom = new JSDOM(loginHtmlContent);
		const loginDocument = loginDom.window.document;

		// Check if loginForm ID exists (should be fixed from loginFormBroken)
		const loginForm = loginDocument.getElementById('loginForm');
		expect(loginForm).toBeTruthy();
		expect(loginForm).not.toBeNull();

		// Check email input type
		const emailInput = loginForm.querySelector('input[name="email"]');
		expect(emailInput).toBeTruthy();
		expect(emailInput.type).toBe('email');

		// Check password input type
		const passwordInput = loginForm.querySelector('input[name="password"]');
		expect(passwordInput).toBeTruthy();
		expect(passwordInput.type).toBe('password');

		// Test signup.html form issues
		const signupHtmlPath = path.join(process.cwd(), 'client', 'signup.html');
		const signupHtmlContent = fs.readFileSync(signupHtmlPath, 'utf8');
		const signupDom = new JSDOM(signupHtmlContent);
		const signupDocument = signupDom.window.document;

		// Check signup form ID
		const signupForm = signupDocument.getElementById('signupForm');
		expect(signupForm).toBeTruthy();
		expect(signupForm).not.toBeNull();

		// Check all required input types in signup form
		const signupEmailInput = signupForm.querySelector('input[name="email"]');
		expect(signupEmailInput).toBeTruthy();
		expect(signupEmailInput.type).toBe('email');

		const signupPasswordInput = signupForm.querySelector('input[name="password"]');
		expect(signupPasswordInput).toBeTruthy();
		expect(signupPasswordInput.type).toBe('password');

		// Check text inputs for names
		const firstNameInput = signupForm.querySelector('input[name="firstName"]');
		expect(firstNameInput).toBeTruthy();
		expect(firstNameInput.type).toBe('text');

		const lastNameInput = signupForm.querySelector('input[name="lastName"]');
		expect(lastNameInput).toBeTruthy();
		expect(lastNameInput.type).toBe('text');
	});

	test("Challenge 10a-2: Fix navigation and responsive design issues", async () => {
		// Test index.html navigation issues
		const indexHtmlPath = path.join(process.cwd(), 'client', 'index.html');
		const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
		const indexDom = new JSDOM(indexHtmlContent);
		const indexDocument = indexDom.window.document;

		// Check signup link ID and href
		const signUpLink = indexDocument.getElementById('signUpLink');
		expect(signUpLink).toBeTruthy();
		expect(signUpLink.href).toContain('signup.html');

		// Check login link ID and href
		const loginLink = indexDocument.getElementById('loginLink');
		expect(loginLink).toBeTruthy();
		expect(loginLink.href).toContain('login.html');

		// Check get started button ID and href
		const getStartedBtn = indexDocument.getElementById('getStartedBtn');
		expect(getStartedBtn).toBeTruthy();
		expect(getStartedBtn.href).toContain('signup.html');

		// Check mobile toggle button exists
		const mobileToggle = indexDocument.querySelector('.navbar-toggler');
		expect(mobileToggle).toBeTruthy();
		expect(mobileToggle.getAttribute('data-bs-toggle')).toBe('collapse');
		expect(mobileToggle.getAttribute('data-bs-target')).toContain('#navbarNav');

		// Check responsive navigation structure
		const navbarCollapse = indexDocument.getElementById('navbarNav');
		expect(navbarCollapse).toBeTruthy();
		expect(navbarCollapse.classList.contains('collapse')).toBeTruthy();
		expect(navbarCollapse.classList.contains('navbar-collapse')).toBeTruthy();

		// Check viewport meta tag for mobile responsiveness
		const viewportMeta = indexDocument.querySelector('meta[name="viewport"]');
		expect(viewportMeta).toBeTruthy();
		expect(viewportMeta.content).toContain('width=device-width');
		expect(viewportMeta.content).toContain('initial-scale=1');

		// Test login.html responsive design
		const loginDom = new JSDOM(fs.readFileSync(path.join(process.cwd(), 'client', 'login.html'), 'utf8'));
		const loginDocument = loginDom.window.document;

		const loginViewportMeta = loginDocument.querySelector('meta[name="viewport"]');
		expect(loginViewportMeta).toBeTruthy();

		// Test signup.html responsive design
		const signupDom = new JSDOM(fs.readFileSync(path.join(process.cwd(), 'client', 'signup.html'), 'utf8'));
		const signupDocument = signupDom.window.document;

		const signupViewportMeta = signupDocument.querySelector('meta[name="viewport"]');
		expect(signupViewportMeta).toBeTruthy();
	});

	// Challenge 10b: RESTful API Design
	test("Challenge 10b-1: Advanced RESTful endpoints", async () => {
		// Test resource collection with advanced filtering
		const collectionResponse = await testSession
			.get("/api/products")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				filter: JSON.stringify({
					price: { $gte: 80, $lte: 200 },
					category: { $in: ["electronics", "books"] },
					stockQuantity: { $gt: 30 }
				}),
				sort: JSON.stringify({ price: -1, name: 1 }),
				fields: "id,name,price,stockQuantity",
				limit: 10,
				offset: 0,
				include: "category,supplier"
			});

		expect(collectionResponse.status).toBe(HttpStatus.OK);
		expect(collectionResponse.body.data.items).toBeDefined();
		expect(collectionResponse.body.data.pagination).toBeDefined();
		expect(collectionResponse.body.data.pagination.total).toBeDefined();
		expect(collectionResponse.body.data.pagination.limit).toBe(10);
		expect(collectionResponse.body.data.pagination.offset).toBe(0);

		// Test nested resource operations
		const nestedCreateResponse = await testSession
			.post(`/api/products/${apiTestProducts[0].id}/variants`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				name: "Large Size",
				sku: "API-PROD-001-L",
				priceModifier: 10.00,
				stockQuantity: 25,
				attributes: {
					size: "L",
					color: "blue"
				}
			});

		expect(nestedCreateResponse.status).toBe(HttpStatus.CREATED);
		expect(nestedCreateResponse.body.data.id).toBeDefined();
		expect(nestedCreateResponse.body.data.parentProductId).toBe(apiTestProducts[0].id);

		// Test resource relationships
		const relationshipResponse = await testSession
			.post(`/api/products/${apiTestProducts[0].id}/relationships/related`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				relatedProductIds: [apiTestProducts[1].id, apiTestProducts[2].id],
				relationshipType: "cross_sell",
				strength: 0.8,
				bidirectional: true
			});

		expect(relationshipResponse.status).toBe(HttpStatus.CREATED);
		expect(relationshipResponse.body.data.relationships).toBeDefined();
		expect(Array.isArray(relationshipResponse.body.data.relationships)).toBeTruthy();

		// Test bulk operations
		const bulkUpdateResponse = await testSession
			.patch("/api/products/bulk")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				updates: [
					{
						id: apiTestProducts[0].id,
						data: { price: 109.99 }
					},
					{
						id: apiTestProducts[1].id,
						data: { stockQuantity: 75 }
					}
				],
				options: {
					validate: true,
					atomic: true,
					dryRun: false
				}
			});

		expect(bulkUpdateResponse.status).toBe(HttpStatus.OK);
		expect(bulkUpdateResponse.body.data.updated).toBeDefined();
		expect(bulkUpdateResponse.body.data.failed).toBeDefined();
		expect(bulkUpdateResponse.body.data.summary).toBeDefined();

		// Test conditional operations with ETags
		const etagResponse = await testSession
			.get(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`);

		const etag = etagResponse.headers.etag;

		const conditionalUpdateResponse = await testSession
			.put(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("If-Match", etag)
			.send({
				name: "Updated API Test Product 1",
				price: 119.99
			});

		expect(conditionalUpdateResponse.status).toBe(HttpStatus.OK);

		// Test optimistic concurrency control
		const staleUpdateResponse = await testSession
			.put(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("If-Match", "stale-etag")
			.send({
				name: "This should fail",
				price: 999.99
			});

		expect(staleUpdateResponse.status).toBe(HttpStatus.PRECONDITION_FAILED);
	});

	test("Challenge 10b-2: Content negotiation and versioning", async () => {
		// Test content negotiation
		const jsonResponse = await testSession
			.get(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("Accept", "application/json");

		expect(jsonResponse.status).toBe(HttpStatus.OK);
		expect(jsonResponse.headers["content-type"]).toContain("application/json");

		const xmlResponse = await testSession
			.get(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("Accept", "application/xml");

		expect(xmlResponse.status).toBe(HttpStatus.OK);
		expect(xmlResponse.headers["content-type"]).toContain("application/xml");

		// Test API versioning via headers
		const v1Response = await testSession
			.get(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("API-Version", "1.0");

		expect(v1Response.status).toBe(HttpStatus.OK);
		expect(v1Response.body.apiVersion).toBe("1.0");

		const v2Response = await testSession
			.get(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("API-Version", "2.0");

		expect(v2Response.status).toBe(HttpStatus.OK);
		expect(v2Response.body.apiVersion).toBe("2.0");
		expect(v2Response.body.data).toBeDefined();

		// Test versioning via URL path
		const pathVersionResponse = await testSession
			.get(`/api/v2/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`);

		expect(pathVersionResponse.status).toBe(HttpStatus.OK);

		// Test backwards compatibility
		const legacyResponse = await testSession
			.get(`/api/legacy/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("Accept", "application/vnd.api+json;version=legacy");

		expect(legacyResponse.status).toBe(HttpStatus.OK);
		expect(legacyResponse.body.product).toBeDefined(); // Legacy format

		// Test deprecation warnings
		const deprecatedResponse = await testSession
			.get(`/api/v1/products/deprecated-endpoint`)
			.set("Authorization", `Bearer ${authToken}`);

		expect(deprecatedResponse.headers["warning"]).toBeDefined();
		expect(deprecatedResponse.headers["sunset"]).toBeDefined();
		expect(deprecatedResponse.headers["link"]).toBeDefined();
	});

	// Challenge 10c: GraphQL Implementation
	test("Challenge 10c-1: GraphQL queries and mutations", async () => {
		// Test basic GraphQL query
		const basicQueryResponse = await testSession
			.post("/graphql")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				query: `
					query GetProducts($limit: Int, $category: String) {
						products(limit: $limit, filter: { category: $category }) {
							id
							name
							price
							stockQuantity
							category {
								name
								description
							}
						}
					}
				`,
				variables: {
					limit: 10,
					category: "electronics"
				}
			});

		expect(basicQueryResponse.status).toBe(HttpStatus.OK);
		expect(basicQueryResponse.body.data.products).toBeDefined();
		expect(Array.isArray(basicQueryResponse.body.data.products)).toBeTruthy();

		// Test complex nested query with fragments
		const nestedQueryResponse = await testSession
			.post("/graphql")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				query: `
					fragment ProductDetails on Product {
						id
						name
						price
						stockQuantity
						category {
							name
						}
					}

					query GetProductWithRelations($id: ID!) {
						product(id: $id) {
							...ProductDetails
							variants {
								id
								name
								priceModifier
								attributes
							}
							relatedProducts {
								...ProductDetails
							}
							analytics {
								totalSales
								averageRating
								viewCount
							}
						}
					}
				`,
				variables: {
					id: apiTestProducts[0].id
				}
			});

		expect(nestedQueryResponse.status).toBe(HttpStatus.OK);
		expect(nestedQueryResponse.body.data.product).toBeDefined();

		// Test GraphQL mutation
		const mutationResponse = await testSession
			.post("/graphql")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				query: `
					mutation UpdateProduct($id: ID!, $input: ProductUpdateInput!) {
						updateProduct(id: $id, input: $input) {
							success
							product {
								id
								name
								price
								updatedAt
							}
							errors {
								field
								message
								code
							}
						}
					}
				`,
				variables: {
					id: apiTestProducts[0].id,
					input: {
						name: "GraphQL Updated Product",
						price: 129.99
					}
				}
			});

		expect(mutationResponse.status).toBe(HttpStatus.OK);
		expect(mutationResponse.body.data.updateProduct.success).toBeTruthy();

		// Test subscription (via POST for testing)
		const subscriptionResponse = await testSession
			.post("/graphql")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				query: `
					subscription ProductUpdates($productId: ID!) {
						productUpdated(productId: $productId) {
							id
							name
							price
							stockQuantity
							updateType
							timestamp
						}
					}
				`,
				variables: {
					productId: apiTestProducts[0].id
				}
			});

		expect(subscriptionResponse.status).toBe(HttpStatus.OK);

		// Test introspection query
		const introspectionResponse = await testSession
			.post("/graphql")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				query: `
					query IntrospectionQuery {
						__schema {
							types {
								name
								kind
								description
							}
							queryType {
								name
								fields {
									name
									type {
										name
									}
								}
							}
						}
					}
				`
			});

		expect(introspectionResponse.status).toBe(HttpStatus.OK);
		expect(introspectionResponse.body.data.__schema).toBeDefined();
	});

	test("Challenge 10c-2: GraphQL advanced features", async () => {
		// Test field-level authorization
		const authFieldResponse = await testSession
			.post("/graphql")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				query: `
					query GetProductWithSensitiveData($id: ID!) {
						product(id: $id) {
							id
							name
							price
							cost  # Admin only field
							profitMargin  # Admin only field
							internalNotes  # Admin only field
						}
					}
				`,
				variables: {
					id: apiTestProducts[0].id
				}
			});

		expect(authFieldResponse.status).toBe(HttpStatus.OK);
		// Should return null for unauthorized fields
		if (authFieldResponse.body.data.product.cost === null) {
			expect(authFieldResponse.body.errors).toBeDefined();
		}

		// Test query complexity analysis
		const complexQueryResponse = await testSession
			.post("/graphql")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				query: `
					query ComplexQuery {
						products(limit: 100) {
							id
							name
							variants {
								id
								name
								relatedProducts {
									id
									variants {
										id
										relatedProducts {
											id
											name
										}
									}
								}
							}
						}
					}
				`
			});

		// Should either succeed or fail with complexity error
		if (complexQueryResponse.status === HttpStatus.BAD_REQUEST) {
			expect(complexQueryResponse.body.errors[0].message).toContain("complexity");
		}

		// Test query depth limiting
		const deepQueryResponse = await testSession
			.post("/graphql")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				query: `
					query DeepQuery {
						products {
							category {
								products {
									category {
										products {
											category {
												products {
													name
												}
											}
										}
									}
								}
							}
						}
					}
				`
			});

		if (deepQueryResponse.status === HttpStatus.BAD_REQUEST) {
			expect(deepQueryResponse.body.errors[0].message).toContain("depth");
		}

		// Test query batching
		const batchResponse = await testSession
			.post("/graphql")
			.set("Authorization", `Bearer ${authToken}`)
			.send([
				{
					query: `query GetProduct1 { product(id: "${apiTestProducts[0].id}") { name } }`
				},
				{
					query: `query GetProduct2 { product(id: "${apiTestProducts[1].id}") { name } }`
				},
				{
					query: `query GetProduct3 { product(id: "${apiTestProducts[2].id}") { name } }`
				}
			]);

		expect(batchResponse.status).toBe(HttpStatus.OK);
		expect(Array.isArray(batchResponse.body)).toBeTruthy();
		expect(batchResponse.body.length).toBe(3);
	});

	// Challenge 10d: Microservices Architecture
	test("Challenge 10d-1: Service mesh and communication", async () => {
		// Test service discovery
		const serviceDiscoveryResponse = await testSession
			.get("/api/services/discovery")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				service: "inventory-service",
				version: "latest",
				environment: "test"
			});

		expect(serviceDiscoveryResponse.status).toBe(HttpStatus.OK);
		expect(serviceDiscoveryResponse.body.data.instances).toBeDefined();
		expect(Array.isArray(serviceDiscoveryResponse.body.data.instances)).toBeTruthy();

		serviceDiscoveryResponse.body.data.instances.forEach(instance => {
			expect(instance.id).toBeDefined();
			expect(instance.address).toBeDefined();
			expect(instance.port).toBeDefined();
			expect(instance.health).toBeDefined();
			expect(instance.metadata).toBeDefined();
		});

		// Test service health checks
		const healthCheckResponse = await testSession
			.get("/api/services/health")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				service: "product-service",
				includeDependent: true
			});

		expect(healthCheckResponse.status).toBe(HttpStatus.OK);
		expect(healthCheckResponse.body.data.status).toBeDefined();
		expect(["healthy", "degraded", "unhealthy"]).toContain(healthCheckResponse.body.data.status);
		expect(healthCheckResponse.body.data.checks).toBeDefined();
		expect(healthCheckResponse.body.data.dependencies).toBeDefined();

		// Test circuit breaker status
		const circuitBreakerResponse = await testSession
			.get("/api/services/circuit-breaker")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				service: "external-payment-service"
			});

		expect(circuitBreakerResponse.status).toBe(HttpStatus.OK);
		expect(circuitBreakerResponse.body.data.state).toBeDefined();
		expect(["closed", "open", "half-open"]).toContain(circuitBreakerResponse.body.data.state);
		expect(circuitBreakerResponse.body.data.failureCount).toBeDefined();
		expect(circuitBreakerResponse.body.data.nextAttempt).toBeDefined();

		// Test service communication tracing
		const tracingResponse = await testSession
			.post("/api/services/trace")
			.set("Authorization", `Bearer ${authToken}`)
			.set("X-Trace-ID", "test-trace-123")
			.send({
				operation: "get_product_details",
				productId: apiTestProducts[0].id,
				includeAnalytics: true
			});

		expect(tracingResponse.status).toBe(HttpStatus.OK);
		expect(tracingResponse.headers["x-trace-id"]).toBe("test-trace-123");
		expect(tracingResponse.body.data.traceId).toBe("test-trace-123");
		expect(tracingResponse.body.data.spans).toBeDefined();

		// Test service versioning and canary deployment
		const canaryResponse = await testSession
			.get(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("X-Canary-Version", "v2.1")
			.set("X-User-Segment", "beta-testers");

		expect(canaryResponse.status).toBe(HttpStatus.OK);
		expect(canaryResponse.headers["x-service-version"]).toBeDefined();
	});

	test("Challenge 10d-2: Event-driven architecture", async () => {
		// Test event publishing
		const publishEventResponse = await testSession
			.post("/api/events/publish")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				eventType: "product.stock.low",
				aggregateId: apiTestProducts[0].id,
				aggregateType: "product",
				eventData: {
					productId: apiTestProducts[0].id,
					currentStock: 5,
					reorderLevel: 10,
					urgency: "high"
				},
				metadata: {
					source: "inventory-service",
					timestamp: new Date().toISOString(),
					version: "1.0"
				}
			});

		expect(publishEventResponse.status).toBe(HttpStatus.OK);
		expect(publishEventResponse.body.data.eventId).toBeDefined();
		expect(publishEventResponse.body.data.published).toBeTruthy();

		// Test event sourcing
		const eventStreamResponse = await testSession
			.get(`/api/events/stream/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				aggregateType: "product",
				fromVersion: 0,
				toVersion: 10
			});

		expect(eventStreamResponse.status).toBe(HttpStatus.OK);
		expect(eventStreamResponse.body.data.events).toBeDefined();
		expect(Array.isArray(eventStreamResponse.body.data.events)).toBeTruthy();
		expect(eventStreamResponse.body.data.currentVersion).toBeDefined();

		// Test event replay and projection
		const replayResponse = await testSession
			.post("/api/events/replay")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				aggregateId: apiTestProducts[0].id,
				aggregateType: "product",
				fromTimestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
				toTimestamp: new Date().toISOString(),
				projectionType: "product-analytics"
			});

		expect(replayResponse.status).toBe(HttpStatus.OK);
		expect(replayResponse.body.data.replayId).toBeDefined();
		expect(replayResponse.body.data.eventsProcessed).toBeDefined();

		// Test SAGA orchestration
		const sagaResponse = await testSession
			.post("/api/sagas/start")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				sagaType: "order-fulfillment",
				sagaData: {
					orderId: "order-123",
					products: [
						{
							productId: apiTestProducts[0].id,
							quantity: 2
						}
					],
					customerId: testUserId
				},
				compensationTimeout: 300000 // 5 minutes
			});

		expect(sagaResponse.status).toBe(HttpStatus.OK);
		expect(sagaResponse.body.data.sagaId).toBeDefined();
		expect(sagaResponse.body.data.status).toBe("started");

		const sagaStatusResponse = await testSession
			.get(`/api/sagas/${sagaResponse.body.data.sagaId}/status`)
			.set("Authorization", `Bearer ${authToken}`);

		expect(sagaStatusResponse.status).toBe(HttpStatus.OK);
		expect(sagaStatusResponse.body.data.steps).toBeDefined();
		expect(sagaStatusResponse.body.data.currentStep).toBeDefined();
		expect(sagaStatusResponse.body.data.completedSteps).toBeDefined();
	});

	// Challenge 10e: API Gateway and Security
	test("Challenge 10e-1: Advanced API gateway features", async () => {
		// Test rate limiting with different tiers
		const rateLimitResponses = [];
		for (let i = 0; i < 15; i++) {
			const response = await testSession
				.get("/api/products")
				.set("Authorization", `Bearer ${authToken}`)
				.set("X-Client-Tier", "premium");
			
			rateLimitResponses.push({
				status: response.status,
				remaining: response.headers["x-ratelimit-remaining"],
				reset: response.headers["x-ratelimit-reset"]
			});
		}

		// Should hit rate limit eventually
		const limitedResponse = rateLimitResponses.find(r => r.status === HttpStatus.TOO_MANY_REQUESTS);
		if (limitedResponse) {
			expect(limitedResponse.remaining).toBe("0");
		}

		// Test API key management
		const apiKeyResponse = await testSession
			.post("/api/gateway/keys")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				name: "Test Integration Key",
				scopes: ["products:read", "products:write"],
				rateLimit: {
					requests: 1000,
					window: "1h"
				},
				ipWhitelist: ["127.0.0.1", "192.168.1.0/24"],
				expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
			});

		expect(apiKeyResponse.status).toBe(HttpStatus.CREATED);
		expect(apiKeyResponse.body.data.apiKey).toBeDefined();
		expect(apiKeyResponse.body.data.keyId).toBeDefined();

		// Test API key usage
		const apiKeyUsageResponse = await testSession
			.get("/api/products")
			.set("X-API-Key", apiKeyResponse.body.data.apiKey);

		expect(apiKeyUsageResponse.status).toBe(HttpStatus.OK);
		expect(apiKeyUsageResponse.headers["x-api-key-id"]).toBeDefined();

		// Test request transformation
		const transformResponse = await testSession
			.post("/api/gateway/transform")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				transformationType: "legacy-adapter",
				sourceFormat: "xml",
				targetFormat: "json",
				requestData: `
					<product>
						<name>Legacy Product</name>
						<price>99.99</price>
					</product>
				`
			});

		expect(transformResponse.status).toBe(HttpStatus.OK);
		expect(transformResponse.body.data.transformedData).toBeDefined();
		expect(typeof transformResponse.body.data.transformedData).toBe("object");

		// Test request/response caching
		const cacheTestResponse1 = await testSession
			.get(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("Cache-Control", "max-age=300");

		expect(cacheTestResponse1.status).toBe(HttpStatus.OK);
		expect(cacheTestResponse1.headers["x-cache"]).toBe("MISS");

		const cacheTestResponse2 = await testSession
			.get(`/api/products/${apiTestProducts[0].id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.set("Cache-Control", "max-age=300");

		expect(cacheTestResponse2.status).toBe(HttpStatus.OK);
		expect(cacheTestResponse2.headers["x-cache"]).toBe("HIT");
	});

	test("Challenge 10e-2: Advanced security and monitoring", async () => {
		// Test JWT token introspection
		const tokenIntrospectionResponse = await testSession
			.post("/api/auth/introspect")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				token: authToken,
				includePermissions: true
			});

		expect(tokenIntrospectionResponse.status).toBe(HttpStatus.OK);
		expect(tokenIntrospectionResponse.body.data.active).toBeTruthy();
		expect(tokenIntrospectionResponse.body.data.sub).toBeDefined();
		expect(tokenIntrospectionResponse.body.data.permissions).toBeDefined();
		expect(tokenIntrospectionResponse.body.data.expiresAt).toBeDefined();

		// Test request signing and verification
		const timestamp = Date.now().toString();
		const nonce = "test-nonce-123";
		const signature = "mock-signature"; // In real implementation, this would be properly calculated

		const signedRequestResponse = await testSession
			.post("/api/secure/signed-request")
			.set("Authorization", `Bearer ${authToken}`)
			.set("X-Timestamp", timestamp)
			.set("X-Nonce", nonce)
			.set("X-Signature", signature)
			.send({
				productId: apiTestProducts[0].id,
				action: "price_update",
				newPrice: 199.99
			});

		// Should validate signature
		expect(signedRequestResponse.status).toBeOneOf([HttpStatus.OK, HttpStatus.UNAUTHORIZED]);

		// Test anomaly detection
		const anomalyResponse = await testSession
			.post("/api/security/anomaly-detection")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				requestPattern: {
					endpoint: "/api/products",
					method: "GET",
					frequency: 100, // requests per minute
					sources: ["192.168.1.100"],
					userAgent: "Test Bot 1.0"
				},
				timeWindow: "5m"
			});

		expect(anomalyResponse.status).toBe(HttpStatus.OK);
		expect(anomalyResponse.body.data.anomalyScore).toBeDefined();
		expect(anomalyResponse.body.data.riskLevel).toBeDefined();
		expect(["low", "medium", "high", "critical"]).toContain(anomalyResponse.body.data.riskLevel);

		// Test API usage analytics
		const analyticsResponse = await testSession
			.get("/api/analytics/usage")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				timeRange: "24h",
				groupBy: "endpoint,method",
				includeErrors: true
			});

		expect(analyticsResponse.status).toBe(HttpStatus.OK);
		expect(analyticsResponse.body.data.metrics).toBeDefined();
		expect(analyticsResponse.body.data.metrics.totalRequests).toBeDefined();
		expect(analyticsResponse.body.data.metrics.averageResponseTime).toBeDefined();
		expect(analyticsResponse.body.data.metrics.errorRate).toBeDefined();
		expect(analyticsResponse.body.data.breakdown).toBeDefined();

		// Test compliance and audit logging
		const auditLogResponse = await testSession
			.get("/api/audit/logs")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				entityType: "product",
				entityId: apiTestProducts[0].id,
				action: "update",
				fromDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
				toDate: new Date().toISOString()
			});

		expect(auditLogResponse.status).toBe(HttpStatus.OK);
		expect(auditLogResponse.body.data.auditLogs).toBeDefined();
		expect(Array.isArray(auditLogResponse.body.data.auditLogs)).toBeTruthy();

		if (auditLogResponse.body.data.auditLogs.length > 0) {
			const log = auditLogResponse.body.data.auditLogs[0];
			expect(log.timestamp).toBeDefined();
			expect(log.userId).toBeDefined();
			expect(log.action).toBeDefined();
			expect(log.resourceType).toBeDefined();
			expect(log.resourceId).toBeDefined();
		}
	});
});
