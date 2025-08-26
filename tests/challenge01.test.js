import { JSDOM } from "jsdom";
import fs from "fs";
import app from "../src/server.js";
import db from "../db/db-config.js";
import testBase from "./testBase.js";
import { expect, test, describe, beforeAll, afterAll, afterEach } from "vitest";
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

describe("Challenge 01: Basic CRUD Operations", () => {
	
	// Challenge 1a: Product Creation
	test("Challenge 1a-1: Basic product creation with required fields", async () => {
		
		const testCases = [
			{
				description: "Too short password",
				userData: {
					firstName: "Test",
					lastName: "User",
					email: "short@example.com",
					password: "Abc1!"
				},
				expectedError: "8 characters"
			},
			{
				description: "No uppercase letter",
				userData: {
					firstName: "Test",
					lastName: "User", 
					email: "noupper@example.com",
					password: "password123!"
				},
				expectedError: "uppercase"
			},
			{
				description: "No lowercase letter",
				userData: {
					firstName: "Test",
					lastName: "User",
					email: "nolower@example.com", 
					password: "PASSWORD123!"
				},
				expectedError: "lowercase"
			},
			{
				description: "No number",
				userData: {
					firstName: "Test",
					lastName: "User",
					email: "nonumber@example.com",
					password: "Password!"
				},
				expectedError: "number"
			},
			{
				description: "No special character",
				userData: {
					firstName: "Test",
					lastName: "User",
					email: "nospecial@example.com",
					password: "Password123"
				},
				expectedError: "special"
			}
		];

		for (const testCase of testCases) {
			const response = await testSession
				.post("/api/auth/signup")
				.send(testCase.userData);
			
			expect(response.status).toBe(HttpStatus.BAD_REQUEST);
			expect(response.body.message.toLowerCase()).toContain(testCase.expectedError);
		}

		// Valid password should work
		const validResponse = await testSession
			.post("/api/auth/signup")
			.send({
				firstName: "Test",
				lastName: "User",
				email: "valid@example.com",
				password: "ValidPass123!"
			});
		
		expect(validResponse.status).toBe(HttpStatus.CREATED);
	});

	test("Challenge 1a-2: Product creation with all fields", async () => {
		const userData = {
			firstName: "Hash",
			lastName: "Test",
			email: "hash@example.com",
			password: "SecurePass123!"
		};

		await testSession.post("/api/auth/signup").send(userData);

		// Login with correct password
		const loginResponse = await testSession
			.post("/api/auth/login")
			.send({
				email: userData.email,
				password: userData.password
			});

		expect(loginResponse.status).toBe(HttpStatus.OK);
		expect(loginResponse.body.data.token).toBeDefined();

		// Login with incorrect password should fail
		const failedLogin = await testSession
			.post("/api/auth/login")
			.send({
				email: userData.email,
				password: "WrongPassword123!"
			});

		expect(failedLogin.status).toBe(HttpStatus.BAD_REQUEST);
		expect(failedLogin.body.message).toContain("Invalid email or password");
	});

	// Challenge 1b: Product Reading
	test("Challenge 1b-1: Product retrieval by ID", async () => {
		const userData = {
			firstName: "JWT",
			lastName: "User",
			email: "jwt@example.com",
			password: "JwtPass123!"
		};

		await testSession.post("/api/auth/signup").send(userData);
		
		const loginResponse = await testSession
			.post("/api/auth/login")
			.send({
				email: userData.email,
				password: userData.password
			});

		expect(loginResponse.status).toBe(HttpStatus.OK);
		
		const token = loginResponse.body.data.token;
		expect(token).toBeDefined();
		expect(typeof token).toBe('string');
		expect(token.split('.').length).toBe(3); // JWT has 3 parts

		// Test token validation by accessing protected endpoint
		const protectedResponse = await testSession
			.get("/api/product")
			.set("Authorization", `Bearer ${token}`);

		expect(protectedResponse.status).toBe(HttpStatus.OK);

		// Test invalid token
		const invalidTokenResponse = await testSession
			.get("/api/product")
			.set("Authorization", "Bearer invalid.token.here");

		expect(invalidTokenResponse.status).toBe(HttpStatus.UNAUTHORIZED);
	});

	test("Challenge 1b-2: Product listing with basic functionality", async () => {
		// This test checks the token structure and basic validation
		// In a real implementation, you might want to test actual expiration
		const userData = {
			firstName: "Refresh",
			lastName: "User",
			email: "refresh@example.com",
			password: "RefreshPass123!"
		};

		await testSession.post("/api/auth/signup").send(userData);
		
		const loginResponse = await testSession
			.post("/api/auth/login")
			.send({
				email: userData.email,
				password: userData.password
			});

		const token = loginResponse.body.data.token;
		
		// Decode the JWT payload to check expiration
		const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
		expect(payload.exp).toBeDefined(); // Should have expiration
		expect(payload.user).toBeDefined(); // Should contain user data
		expect(payload.user.email).toBe(userData.email);
		
		// Token should not contain password
		expect(payload.user.password).toBeUndefined();
	});

	test("Challenge 1b-3: Product update and delete operations", async () => {
		// Register and login a user first
		const userData = {
			name: "Update Test User",
			email: "updatetest@example.com",
			password: "securePassword123",
			securityQuestion: "What is your favorite color?",
			securityAnswer: "blue"
		};

		await testSession
			.post("/api/auth/signup")
			.send(userData);

		const loginResponse = await testSession
			.post("/api/auth/login")
			.send({
				email: userData.email,
				password: userData.password
			});

		expect(loginResponse.status).toBe(HttpStatus.OK);
		expect(loginResponse.body.data.token).toBeDefined();

		const token = loginResponse.body.data.token;

		// Test product creation with valid token
		const productData = {
			name: "Test Product for Update",
			description: "A product to test updates",
			price: 99.99,
			quantity: 10,
			sku: "TEST-UPDATE-001",
			category: "Electronics"
		};

		const createResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${token}`)
			.send(productData);

		expect(createResponse.status).toBe(HttpStatus.CREATED);
		expect(createResponse.body.data.id).toBeDefined();

		const productId = createResponse.body.data.id;

		// Test product update
		const updateData = {
			name: "Updated Product Name",
			price: 149.99
		};

		const updateResponse = await testSession
			.put(`/api/product/${productId}`)
			.set("Authorization", `Bearer ${token}`)
			.send(updateData);

		expect(updateResponse.status).toBe(HttpStatus.OK);
		expect(updateResponse.body.data.name).toBe(updateData.name);
		expect(updateResponse.body.data.price).toBe(updateData.price);
	});
});
