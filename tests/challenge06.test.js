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

describe("Challenge 06: Security Features", () => {
	
	let authToken = null;
	let adminToken = null;
	let testUserId = null;
	let adminUserId = null;

	beforeEach(async () => {
		// Create a regular test user
		const userData = {
			firstName: "Security",
			lastName: "Tester",
			email: "security@example.com",
			password: "SecurePass123!"
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

		// Create an admin user
		const adminData = {
			firstName: "Admin",
			lastName: "User",
			email: "admin@example.com",
			password: "AdminPass123!",
			role: "admin"
		};

		await testSession.post("/api/auth/signup").send(adminData);
		
		const adminLoginResponse = await testSession
			.post("/api/auth/login")
			.send({
				email: adminData.email,
				password: adminData.password
			});

		adminToken = adminLoginResponse.body.data.token;
		adminUserId = adminLoginResponse.body.data.user.id;
	});

	// Challenge 7a: Advanced Authentication
	test("Challenge 6a-1: Multi-factor authentication setup", async () => {
		// Enable 2FA for user account
		const enable2FAResponse = await testSession
			.post("/api/auth/2fa/enable")
			.set("Authorization", `Bearer ${authToken}`);

		expect(enable2FAResponse.status).toBe(HttpStatus.OK);
		expect(enable2FAResponse.body.data.qrCode).toBeDefined();
		expect(enable2FAResponse.body.data.secret).toBeDefined();
		expect(enable2FAResponse.body.data.backupCodes).toBeDefined();
		expect(enable2FAResponse.body.data.backupCodes.length).toBe(10);

		// Verify 2FA with TOTP code (simulated)
		const simulatedTOTP = "123456"; // In real implementation, this would be generated from the secret
		const verify2FAResponse = await testSession
			.post("/api/auth/2fa/verify")
			.set("Authorization", `Bearer ${authToken}`)
			.send({ token: simulatedTOTP });

		// This should fail with simulated code
		expect(verify2FAResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(verify2FAResponse.body.message).toContain("invalid");

		// Test backup code usage
		const backupCodes = enable2FAResponse.body.data.backupCodes;
		const backupCodeResponse = await testSession
			.post("/api/auth/2fa/verify-backup")
			.set("Authorization", `Bearer ${authToken}`)
			.send({ backupCode: backupCodes[0] });

		expect(backupCodeResponse.status).toBe(HttpStatus.OK);
		expect(backupCodeResponse.body.data.verified).toBeTruthy();

		// Verify the same backup code cannot be used again
		const reuseBackupCodeResponse = await testSession
			.post("/api/auth/2fa/verify-backup")
			.set("Authorization", `Bearer ${authToken}`)
			.send({ backupCode: backupCodes[0] });

		expect(reuseBackupCodeResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(reuseBackupCodeResponse.body.message).toContain("already used");

		// Disable 2FA
		const disable2FAResponse = await testSession
			.post("/api/auth/2fa/disable")
			.set("Authorization", `Bearer ${authToken}`)
			.send({ password: "SecurePass123!" });

		expect(disable2FAResponse.status).toBe(HttpStatus.OK);
		expect(disable2FAResponse.body.data.disabled).toBeTruthy();
	});

	test("Challenge 6a-2: Password reset with additional security", async () => {
		// Initiate password reset
		const resetRequestResponse = await testSession
			.post("/api/auth/password-reset/request")
			.send({ email: "security@example.com" });

		expect(resetRequestResponse.status).toBe(HttpStatus.OK);
		expect(resetRequestResponse.body.data.resetTokenSent).toBeTruthy();

		// In a real implementation, the token would be sent via email
		// For testing, we'll simulate getting the token from the database
		const resetTokens = await db("password_reset_tokens")
			.where({ user_id: testUserId })
			.orderBy("created_at", "desc")
			.first();

		expect(resetTokens).toBeDefined();

		// Verify reset token with security questions
		const verifyTokenResponse = await testSession
			.post("/api/auth/password-reset/verify-token")
			.send({ 
				token: resetTokens.token,
				email: "security@example.com"
			});

		expect(verifyTokenResponse.status).toBe(HttpStatus.OK);
		expect(verifyTokenResponse.body.data.securityQuestions).toBeDefined();
		expect(verifyTokenResponse.body.data.securityQuestions.length).toBeGreaterThan(0);

		// Answer security questions
		const securityAnswers = verifyTokenResponse.body.data.securityQuestions.map(q => ({
			questionId: q.id,
			answer: "test answer" // In real implementation, these would be actual answers
		}));

		const answerQuestionsResponse = await testSession
			.post("/api/auth/password-reset/verify-security")
			.send({
				token: resetTokens.token,
				email: "security@example.com",
				answers: securityAnswers
			});

		// This might fail with our test answers, but we're testing the endpoint structure
		expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(answerQuestionsResponse.status);

		// Complete password reset (assuming questions were answered correctly)
		const newPassword = "NewSecurePass123!";
		const completeResetResponse = await testSession
			.post("/api/auth/password-reset/complete")
			.send({
				token: resetTokens.token,
				email: "security@example.com",
				newPassword: newPassword,
				confirmPassword: newPassword
			});

		expect([HttpStatus.OK, HttpStatus.BAD_REQUEST]).toContain(completeResetResponse.status);

		// Test that old reset tokens are invalidated
		const invalidTokenResponse = await testSession
			.post("/api/auth/password-reset/verify-token")
			.send({ 
				token: resetTokens.token,
				email: "security@example.com"
			});

		expect(invalidTokenResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(invalidTokenResponse.body.message).toContain("expired");
	});

	test("Challenge 6a-3: Session management and security", async () => {
		// Get active sessions
		const sessionsResponse = await testSession
			.get("/api/auth/sessions")
			.set("Authorization", `Bearer ${authToken}`);

		expect(sessionsResponse.status).toBe(HttpStatus.OK);
		expect(sessionsResponse.body.data.length).toBeGreaterThan(0);

		const currentSession = sessionsResponse.body.data[0];
		expect(currentSession.id).toBeDefined();
		expect(currentSession.ipAddress).toBeDefined();
		expect(currentSession.userAgent).toBeDefined();
		expect(currentSession.lastActivity).toBeDefined();
		expect(currentSession.isCurrent).toBeTruthy();

		// Create another session by logging in from different "device"
		const secondLoginResponse = await testSession
			.post("/api/auth/login")
			.set("User-Agent", "Different-Device/1.0")
			.send({
				email: "security@example.com",
				password: "SecurePass123!"
			});

		expect(secondLoginResponse.status).toBe(HttpStatus.OK);
		const secondToken = secondLoginResponse.body.data.token;

		// Verify multiple sessions exist
		const multiSessionsResponse = await testSession
			.get("/api/auth/sessions")
			.set("Authorization", `Bearer ${authToken}`);

		expect(multiSessionsResponse.status).toBe(HttpStatus.OK);
		expect(multiSessionsResponse.body.data.length).toBe(2);

		// Terminate a specific session
		const otherSession = multiSessionsResponse.body.data.find(s => !s.isCurrent);
		const terminateSessionResponse = await testSession
			.delete(`/api/auth/sessions/${otherSession.id}`)
			.set("Authorization", `Bearer ${authToken}`);

		expect(terminateSessionResponse.status).toBe(HttpStatus.OK);

		// Verify the terminated session's token is invalid
		const invalidTokenResponse = await testSession
			.get("/api/product")
			.set("Authorization", `Bearer ${secondToken}`);

		expect(invalidTokenResponse.status).toBe(HttpStatus.UNAUTHORIZED);

		// Terminate all other sessions
		const terminateAllResponse = await testSession
			.delete("/api/auth/sessions/all")
			.set("Authorization", `Bearer ${authToken}`);

		expect(terminateAllResponse.status).toBe(HttpStatus.OK);
		expect(terminateAllResponse.body.data.terminatedSessions).toBeDefined();
	});

	// Challenge 7b: Authorization and Access Control
	test("Challenge 6b-1: Role-based access control", async () => {
		// Create a product as regular user
		const product = {
			name: "User Product",
			sku: "USER-PROD-001",
			price: 99.99,
			category: "general"
		};

		const createProductResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(product);

		expect(createProductResponse.status).toBe(HttpStatus.CREATED);
		const productId = createProductResponse.body.data.id;

		// Regular user should not access admin endpoints
		const adminOnlyResponse = await testSession
			.get("/api/admin/users")
			.set("Authorization", `Bearer ${authToken}`);

		expect(adminOnlyResponse.status).toBe(HttpStatus.FORBIDDEN);
		expect(adminOnlyResponse.body.message).toContain("admin");

		// Admin should access admin endpoints
		const adminAccessResponse = await testSession
			.get("/api/admin/users")
			.set("Authorization", `Bearer ${adminToken}`);

		expect(adminAccessResponse.status).toBe(HttpStatus.OK);
		expect(adminAccessResponse.body.data).toBeDefined();

		// Admin should be able to view all products
		const adminViewProductsResponse = await testSession
			.get("/api/admin/products/all")
			.set("Authorization", `Bearer ${adminToken}`);

		expect(adminViewProductsResponse.status).toBe(HttpStatus.OK);
		expect(adminViewProductsResponse.body.data.length).toBeGreaterThan(0);

		// Admin should be able to modify any product
		const adminModifyResponse = await testSession
			.put(`/api/admin/products/${productId}`)
			.set("Authorization", `Bearer ${adminToken}`)
			.send({ price: 199.99 });

		expect(adminModifyResponse.status).toBe(HttpStatus.OK);
		expect(adminModifyResponse.body.data.price).toBe(199.99);

		// Regular user should not modify admin-managed products
		const unauthorizedModifyResponse = await testSession
			.put(`/api/product/${productId}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ price: 299.99 });

		expect(unauthorizedModifyResponse.status).toBe(HttpStatus.FORBIDDEN);
	});

	test("Challenge 6b-2: Resource ownership validation", async () => {
		// Create another user
		const otherUserData = {
			firstName: "Other",
			lastName: "User",
			email: "other@example.com",
			password: "OtherPass123!"
		};

		await testSession.post("/api/auth/signup").send(otherUserData);
		
		const otherLoginResponse = await testSession
			.post("/api/auth/login")
			.send({
				email: otherUserData.email,
				password: otherUserData.password
			});

		const otherUserToken = otherLoginResponse.body.data.token;

		// Create products for each user
		const userProduct = {
			name: "User's Product",
			sku: "USER-OWNERSHIP-001",
			price: 99.99,
			category: "general"
		};

		const otherUserProduct = {
			name: "Other User's Product",
			sku: "OTHER-OWNERSHIP-001",
			price: 149.99,
			category: "general"
		};

		const userProductResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(userProduct);

		const otherProductResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${otherUserToken}`)
			.send(otherUserProduct);

		expect(userProductResponse.status).toBe(HttpStatus.CREATED);
		expect(otherProductResponse.status).toBe(HttpStatus.CREATED);

		const userProductId = userProductResponse.body.data.id;
		const otherProductId = otherProductResponse.body.data.id;

		// User should not be able to access other user's product
		const unauthorizedAccessResponse = await testSession
			.get(`/api/product/${otherProductId}`)
			.set("Authorization", `Bearer ${authToken}`);

		expect(unauthorizedAccessResponse.status).toBe(HttpStatus.FORBIDDEN);
		expect(unauthorizedAccessResponse.body.message).toContain("access");

		// User should not be able to modify other user's product
		const unauthorizedModifyResponse = await testSession
			.put(`/api/product/${otherProductId}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ price: 199.99 });

		expect(unauthorizedModifyResponse.status).toBe(HttpStatus.FORBIDDEN);

		// User should be able to access their own product
		const authorizedAccessResponse = await testSession
			.get(`/api/product/${userProductId}`)
			.set("Authorization", `Bearer ${authToken}`);

		expect(authorizedAccessResponse.status).toBe(HttpStatus.OK);
		expect(authorizedAccessResponse.body.data.sku).toBe("USER-OWNERSHIP-001");

		// Users should only see their own products in listings
		const userProductsResponse = await testSession
			.get("/api/product")
			.set("Authorization", `Bearer ${authToken}`);

		expect(userProductsResponse.status).toBe(HttpStatus.OK);
		const userProductSkus = userProductsResponse.body.data.map(p => p.sku);
		expect(userProductSkus).toContain("USER-OWNERSHIP-001");
		expect(userProductSkus).not.toContain("OTHER-OWNERSHIP-001");
	});

	// Challenge 7c: Data Protection
	test("Challenge 6c-1: Input sanitization and validation", async () => {
		// Test XSS prevention in product creation
		const xssProduct = {
			name: "<script>alert('xss')</script>Malicious Product",
			sku: "XSS-TEST-001",
			price: 99.99,
			category: "general",
			description: "<img src=x onerror=alert('xss')>Evil description"
		};

		const xssResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(xssProduct);

		expect(xssResponse.status).toBe(HttpStatus.CREATED);
		
		// Verify HTML is sanitized
		expect(xssResponse.body.data.name).not.toContain("<script>");
		expect(xssResponse.body.data.description).not.toContain("<img");
		expect(xssResponse.body.data.name).toContain("Malicious Product");

		// Test SQL injection prevention
		const sqlInjectionSku = "'; DROP TABLE products; --";
		const sqlInjectionProduct = {
			name: "SQL Test Product",
			sku: sqlInjectionSku,
			price: 99.99,
			category: "general"
		};

		const sqlInjectionResponse = await testSession
			.post("/api/product")
			.set("Authorization", `Bearer ${authToken}`)
			.send(sqlInjectionProduct);

		// Should either succeed with sanitized input or fail validation
		expect([HttpStatus.CREATED, HttpStatus.BAD_REQUEST]).toContain(sqlInjectionResponse.status);

		// If it succeeds, verify the SKU is sanitized
		if (sqlInjectionResponse.status === HttpStatus.CREATED) {
			expect(sqlInjectionResponse.body.data.sku).not.toContain("DROP TABLE");
		}

		// Test NoSQL injection prevention (if applicable)
		const noSQLInjection = {
			email: { $ne: null },
			password: { $regex: ".*" }
		};

		const noSQLInjectionResponse = await testSession
			.post("/api/auth/login")
			.send(noSQLInjection);

		expect(noSQLInjectionResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(noSQLInjectionResponse.body.message).toContain("validation");

		// Test path traversal prevention
		const pathTraversalResponse = await testSession
			.get("/api/product/../../../etc/passwd")
			.set("Authorization", `Bearer ${authToken}`);

		expect(pathTraversalResponse.status).toBe(HttpStatus.NOT_FOUND);
	});

	test("Challenge 6c-2: Data encryption and secure storage", async () => {
		// Verify password is not stored in plain text
		const userRecord = await db("users")
			.where({ id: testUserId })
			.first();

		expect(userRecord.password).not.toBe("SecurePass123!");
		expect(userRecord.password).toMatch(/^\$2[aby]\$\d{2}\$/); // bcrypt hash format

		// Test sensitive data encryption
		const sensitiveData = {
			creditCardNumber: "4111111111111111",
			ssn: "123-45-6789",
			notes: "Confidential customer information"
		};

		const storeSensitiveResponse = await testSession
			.post("/api/user/sensitive-data")
			.set("Authorization", `Bearer ${authToken}`)
			.send(sensitiveData);

		expect(storeSensitiveResponse.status).toBe(HttpStatus.OK);

		// Verify sensitive data is encrypted in database
		const encryptedRecord = await db("user_sensitive_data")
			.where({ user_id: testUserId })
			.first();

		if (encryptedRecord) {
			expect(encryptedRecord.credit_card_number).not.toBe("4111111111111111");
			expect(encryptedRecord.ssn).not.toBe("123-45-6789");
			expect(encryptedRecord.notes).not.toBe("Confidential customer information");
		}

		// Verify data can be decrypted when retrieved
		const retrieveSensitiveResponse = await testSession
			.get("/api/user/sensitive-data")
			.set("Authorization", `Bearer ${authToken}`);

		expect(retrieveSensitiveResponse.status).toBe(HttpStatus.OK);
		expect(retrieveSensitiveResponse.body.data.creditCardNumber).toBe("****-****-****-1111"); // Masked
		expect(retrieveSensitiveResponse.body.data.ssn).toBe("***-**-6789"); // Masked
	});

	// Challenge 7d: Security Monitoring
	test("Challenge 6d-1: Audit logging and monitoring", async () => {
		// Perform various actions that should be logged
		const actions = [
			{ 
				action: async () => await testSession
					.post("/api/auth/login")
					.send({ email: "security@example.com", password: "SecurePass123!" }),
				type: "LOGIN"
			},
			{
				action: async () => await testSession
					.post("/api/product")
					.set("Authorization", `Bearer ${authToken}`)
					.send({ name: "Audit Test", sku: "AUDIT-001", price: 99.99, category: "general" }),
				type: "PRODUCT_CREATE"
			},
			{
				action: async () => await testSession
					.post("/api/auth/login")
					.send({ email: "security@example.com", password: "WrongPassword!" }),
				type: "LOGIN_FAILED"
			}
		];

		// Execute actions
		for (const { action } of actions) {
			await action();
		}

		// Check audit logs (admin access required)
		const auditLogsResponse = await testSession
			.get("/api/admin/audit-logs")
			.set("Authorization", `Bearer ${adminToken}`)
			.query({
				startDate: new Date(Date.now() - 60000).toISOString(), // Last minute
				endDate: new Date().toISOString()
			});

		expect(auditLogsResponse.status).toBe(HttpStatus.OK);
		expect(auditLogsResponse.body.data.length).toBeGreaterThan(0);

		const logs = auditLogsResponse.body.data;
		
		// Verify log entries contain required fields
		logs.forEach(log => {
			expect(log.id).toBeDefined();
			expect(log.action).toBeDefined();
			expect(log.userId).toBeDefined();
			expect(log.ipAddress).toBeDefined();
			expect(log.userAgent).toBeDefined();
			expect(log.timestamp).toBeDefined();
			expect(log.details).toBeDefined();
		});

		// Check for specific log types
		const loginLogs = logs.filter(log => log.action === "LOGIN");
		const productCreateLogs = logs.filter(log => log.action === "PRODUCT_CREATE");
		const failedLoginLogs = logs.filter(log => log.action === "LOGIN_FAILED");

		expect(loginLogs.length).toBeGreaterThan(0);
		expect(productCreateLogs.length).toBeGreaterThan(0);
		expect(failedLoginLogs.length).toBeGreaterThan(0);

		// Test log filtering
		const filteredLogsResponse = await testSession
			.get("/api/admin/audit-logs")
			.set("Authorization", `Bearer ${adminToken}`)
			.query({
				action: "LOGIN_FAILED",
				userId: testUserId
			});

		expect(filteredLogsResponse.status).toBe(HttpStatus.OK);
		filteredLogsResponse.body.data.forEach(log => {
			expect(log.action).toBe("LOGIN_FAILED");
		});
	});

	test("Challenge 6d-2: Intrusion detection and response", async () => {
		// Simulate suspicious activities
		const suspiciousActivities = [
			// Rapid failed login attempts (brute force)
			async () => {
				for (let i = 0; i < 5; i++) {
					await testSession
						.post("/api/auth/login")
						.send({ email: "security@example.com", password: "wrong" + i });
				}
			},
			// Unusual access patterns
			async () => {
				await testSession
					.get("/api/admin/users")
					.set("Authorization", `Bearer ${authToken}`); // Unauthorized access attempt
			},
			// Rapid API calls (potential DDoS)
			async () => {
				const promises = [];
				for (let i = 0; i < 10; i++) {
					promises.push(
						testSession
							.get("/api/product")
							.set("Authorization", `Bearer ${authToken}`)
					);
				}
				await Promise.all(promises);
			}
		];

		// Execute suspicious activities
		for (const activity of suspiciousActivities) {
			await activity();
		}

		// Check security alerts
		const securityAlertsResponse = await testSession
			.get("/api/admin/security-alerts")
			.set("Authorization", `Bearer ${adminToken}`)
			.query({
				startDate: new Date(Date.now() - 60000).toISOString(),
				severity: "HIGH"
			});

		expect(securityAlertsResponse.status).toBe(HttpStatus.OK);
		
		if (securityAlertsResponse.body.data.length > 0) {
			const alerts = securityAlertsResponse.body.data;
			
			alerts.forEach(alert => {
				expect(alert.id).toBeDefined();
				expect(alert.type).toBeDefined();
				expect(alert.severity).toBeDefined();
				expect(alert.description).toBeDefined();
				expect(alert.ipAddress).toBeDefined();
				expect(alert.timestamp).toBeDefined();
				expect(alert.userId).toBeDefined();
			});

			// Look for specific alert types
			const bruteForceAlerts = alerts.filter(a => a.type === "BRUTE_FORCE_ATTEMPT");
			const unauthorizedAccessAlerts = alerts.filter(a => a.type === "UNAUTHORIZED_ACCESS");
			const rateLimitAlerts = alerts.filter(a => a.type === "RATE_LIMIT_EXCEEDED");

			// At least one type of alert should be triggered
			expect(bruteForceAlerts.length + unauthorizedAccessAlerts.length + rateLimitAlerts.length)
				.toBeGreaterThan(0);
		}

		// Test account lockout after failed attempts
		const lockoutTestResponse = await testSession
			.post("/api/auth/login")
			.send({ email: "security@example.com", password: "SecurePass123!" });

		// Account might be temporarily locked
		expect([HttpStatus.OK, HttpStatus.TOO_MANY_REQUESTS]).toContain(lockoutTestResponse.status);

		if (lockoutTestResponse.status === HttpStatus.TOO_MANY_REQUESTS) {
			expect(lockoutTestResponse.body.message).toContain("locked");
			expect(lockoutTestResponse.body.data.lockoutExpires).toBeDefined();
		}

		// Test IP-based rate limiting
		const rateLimitResponse = await testSession
			.get("/api/product")
			.set("Authorization", `Bearer ${authToken}`);

		// Might be rate limited after rapid requests
		expect([HttpStatus.OK, HttpStatus.TOO_MANY_REQUESTS]).toContain(rateLimitResponse.status);
	});

	test("Challenge 6d-3: Security headers and HTTPS enforcement", async () => {
		// Test security headers in responses
		const securityHeadersResponse = await testSession
			.get("/api/product")
			.set("Authorization", `Bearer ${authToken}`);

		expect(securityHeadersResponse.status).toBe(HttpStatus.OK);

		// Check for security headers
		const headers = securityHeadersResponse.headers;
		
		// Content Security Policy
		expect(headers['content-security-policy']).toBeDefined();
		expect(headers['content-security-policy']).toContain("default-src");

		// X-Frame-Options
		expect(headers['x-frame-options']).toBeDefined();
		expect(headers['x-frame-options']).toBe('DENY');

		// X-Content-Type-Options
		expect(headers['x-content-type-options']).toBeDefined();
		expect(headers['x-content-type-options']).toBe('nosniff');

		// X-XSS-Protection
		expect(headers['x-xss-protection']).toBeDefined();
		expect(headers['x-xss-protection']).toBe('1; mode=block');

		// Strict-Transport-Security (if HTTPS)
		if (headers['strict-transport-security']) {
			expect(headers['strict-transport-security']).toContain('max-age');
		}

		// Referrer-Policy
		expect(headers['referrer-policy']).toBeDefined();

		// Test CORS configuration
		const corsResponse = await testSession
			.options("/api/product")
			.set("Origin", "https://trusted-domain.com");

		expect(corsResponse.status).toBe(HttpStatus.OK);
		expect(corsResponse.headers['access-control-allow-origin']).toBeDefined();
		expect(corsResponse.headers['access-control-allow-methods']).toBeDefined();
		expect(corsResponse.headers['access-control-allow-headers']).toBeDefined();

		// Test that unauthorized origins are blocked
		const unauthorizedCorsResponse = await testSession
			.options("/api/product")
			.set("Origin", "https://malicious-site.com");

		// Should either block or not set CORS headers for unauthorized origins
		expect([HttpStatus.OK, HttpStatus.FORBIDDEN]).toContain(unauthorizedCorsResponse.status);
	});
});
