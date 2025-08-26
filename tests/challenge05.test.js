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

describe("Challenge 05: Real-time Dashboard", () => {
	
	let authToken = null;
	let testUserId = null;
	let testProducts = [];

	beforeEach(async () => {
		// Create a test user and get auth token
		const userData = {
			firstName: "Dashboard",
			lastName: "Tester",
			email: "dashboard@example.com",
			password: "DashPass123!"
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

		// Create diverse test products for dashboard analytics
		const products = [
			// High value, low stock products
			{
				name: "Premium Laptop",
				sku: "DASH-LAPTOP-001",
				price: 2499.99,
				stockQuantity: 5, // Below reorder level
				reorderLevel: 10,
				category: "electronics"
			},
			{
				name: "Gaming Desktop",
				sku: "DASH-DESKTOP-001",
				price: 1899.99,
				stockQuantity: 8, // Below reorder level
				reorderLevel: 12,
				category: "electronics"
			},
			// Medium value products
			{
				name: "Wireless Headphones",
				sku: "DASH-HEADPHONES-001",
				price: 299.99,
				stockQuantity: 25,
				reorderLevel: 15,
				category: "audio"
			},
			{
				name: "Smart Watch",
				sku: "DASH-WATCH-001",
				price: 399.99,
				stockQuantity: 30,
				reorderLevel: 20,
				category: "wearables"
			},
			// Low value, high stock products
			{
				name: "Phone Case",
				sku: "DASH-CASE-001",
				price: 19.99,
				stockQuantity: 150,
				reorderLevel: 50,
				category: "accessories"
			},
			{
				name: "Charging Cable",
				sku: "DASH-CABLE-001",
				price: 9.99,
				stockQuantity: 200,
				reorderLevel: 75,
				category: "accessories"
			},
			// Out of stock product
			{
				name: "Out of Stock Item",
				sku: "DASH-OUTSTOCK-001",
				price: 59.99,
				stockQuantity: 0,
				reorderLevel: 10,
				category: "general"
			},
			// Inactive product
			{
				name: "Discontinued Product",
				sku: "DASH-DISCONTINUED-001",
				price: 79.99,
				stockQuantity: 25,
				reorderLevel: 10,
				category: "general"
			}
		];

		testProducts = [];
		for (const product of products) {
			const response = await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);

			expect(response.status).toBe(HttpStatus.CREATED);
			testProducts.push(response.body.data);
		}

		// Deactivate the discontinued product
		const discontinuedProduct = testProducts.find(p => p.sku === "DASH-DISCONTINUED-001");
		await testSession
			.put(`/api/product/${discontinuedProduct.id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ isActive: false });
	});

	// Challenge 6a: Analytics Data
	test("Challenge 5a-1: Dashboard overview statistics", async () => {
		const dashboardResponse = await testSession
			.get("/api/dashboard/overview")
			.set("Authorization", `Bearer ${authToken}`);

		expect(dashboardResponse.status).toBe(HttpStatus.OK);
		
		const overview = dashboardResponse.body.data;
		
		// Verify basic counts
		expect(overview.totalProducts).toBe(7); // Excluding inactive product
		expect(overview.totalActiveProducts).toBe(7);
		expect(overview.totalInactiveProducts).toBe(1);
		expect(overview.outOfStockProducts).toBe(1);
		expect(overview.lowStockProducts).toBe(2); // Products below reorder level

		// Verify total inventory value calculation
		const expectedTotalValue = testProducts
			.filter(p => p.sku !== "DASH-DISCONTINUED-001") // Exclude inactive
			.reduce((sum, product) => sum + (product.price * product.stockQuantity), 0);
		
		expect(overview.totalInventoryValue).toBeCloseTo(expectedTotalValue, 2);

		// Verify average product price
		const activePrices = testProducts
			.filter(p => p.sku !== "DASH-DISCONTINUED-001")
			.map(p => p.price);
		const expectedAvgPrice = activePrices.reduce((sum, price) => sum + price, 0) / activePrices.length;
		
		expect(overview.averageProductPrice).toBeCloseTo(expectedAvgPrice, 2);

		// Verify categories count
		const uniqueCategories = new Set(
			testProducts
				.filter(p => p.sku !== "DASH-DISCONTINUED-001")
				.map(p => p.category)
		);
		expect(overview.totalCategories).toBe(uniqueCategories.size);
	});

	test("Challenge 5a-2: Category breakdown analytics", async () => {
		const categoryStatsResponse = await testSession
			.get("/api/dashboard/categories")
			.set("Authorization", `Bearer ${authToken}`);

		expect(categoryStatsResponse.status).toBe(HttpStatus.OK);
		
		const categories = categoryStatsResponse.body.data;
		
		// Verify we have the correct categories
		const categoryNames = categories.map(c => c.category);
		expect(categoryNames).toContain("electronics");
		expect(categoryNames).toContain("audio");
		expect(categoryNames).toContain("wearables");
		expect(categoryNames).toContain("accessories");
		expect(categoryNames).toContain("general");

		// Verify electronics category stats
		const electronics = categories.find(c => c.category === "electronics");
		expect(electronics.productCount).toBe(2);
		expect(electronics.totalValue).toBeCloseTo(2499.99 * 5 + 1899.99 * 8, 2);
		expect(electronics.averagePrice).toBeCloseTo((2499.99 + 1899.99) / 2, 2);
		expect(electronics.lowStockCount).toBe(2); // Both below reorder level

		// Verify accessories category stats
		const accessories = categories.find(c => c.category === "accessories");
		expect(accessories.productCount).toBe(2);
		expect(accessories.totalValue).toBeCloseTo(19.99 * 150 + 9.99 * 200, 2);
		expect(accessories.lowStockCount).toBe(0); // Both above reorder level

		// Verify general category (should exclude inactive and include out of stock)
		const general = categories.find(c => c.category === "general");
		expect(general.productCount).toBe(1); // Only out of stock item (active)
		expect(general.outOfStockCount).toBe(1);
	});

	test("Challenge 5a-3: Stock level distribution", async () => {
		const stockDistributionResponse = await testSession
			.get("/api/dashboard/stock-distribution")
			.set("Authorization", `Bearer ${authToken}`);

		expect(stockDistributionResponse.status).toBe(HttpStatus.OK);
		
		const distribution = stockDistributionResponse.body.data;
		
		// Verify stock level categorization
		expect(distribution.outOfStock).toBe(1); // One product with 0 stock
		expect(distribution.lowStock).toBe(2); // Two products below reorder level
		expect(distribution.normalStock).toBe(2); // Two products above reorder level but <= 50
		expect(distribution.highStock).toBe(2); // Two products with > 50 stock

		// Verify total adds up correctly (excluding inactive products)
		const totalActive = distribution.outOfStock + distribution.lowStock + 
						   distribution.normalStock + distribution.highStock;
		expect(totalActive).toBe(7);

		// Verify percentage calculations
		expect(distribution.outOfStockPercentage).toBeCloseTo(1/7 * 100, 1);
		expect(distribution.lowStockPercentage).toBeCloseTo(2/7 * 100, 1);
		expect(distribution.normalStockPercentage).toBeCloseTo(2/7 * 100, 1);
		expect(distribution.highStockPercentage).toBeCloseTo(2/7 * 100, 1);
	});

	// Challenge 6b: Alerts and Notifications
	test("Challenge 5b-1: Critical alerts generation", async () => {
		const alertsResponse = await testSession
			.get("/api/dashboard/alerts")
			.set("Authorization", `Bearer ${authToken}`);

		expect(alertsResponse.status).toBe(HttpStatus.OK);
		
		const alerts = alertsResponse.body.data;
		
		// Verify alert structure and content
		expect(alerts.length).toBeGreaterThan(0);
		
		// Check for out of stock alert
		const outOfStockAlert = alerts.find(alert => 
			alert.type === "OUT_OF_STOCK" && alert.productSku === "DASH-OUTSTOCK-001"
		);
		expect(outOfStockAlert).toBeDefined();
		expect(outOfStockAlert.severity).toBe("CRITICAL");
		expect(outOfStockAlert.message).toContain("out of stock");

		// Check for low stock alerts
		const lowStockAlerts = alerts.filter(alert => alert.type === "LOW_STOCK");
		expect(lowStockAlerts.length).toBe(2); // Two products below reorder level
		
		lowStockAlerts.forEach(alert => {
			expect(alert.severity).toBe("HIGH");
			expect(alert.message).toContain("below reorder level");
			expect(["DASH-LAPTOP-001", "DASH-DESKTOP-001"]).toContain(alert.productSku);
		});

		// Check for high value low stock alert
		const highValueLowStockAlert = alerts.find(alert => 
			alert.type === "HIGH_VALUE_LOW_STOCK"
		);
		expect(highValueLowStockAlert).toBeDefined();
		expect(highValueLowStockAlert.severity).toBe("HIGH");
		expect(highValueLowStockAlert.message).toContain("high-value products");

		// Verify alerts are sorted by severity and timestamp
		const criticalAlerts = alerts.filter(a => a.severity === "CRITICAL");
		const highAlerts = alerts.filter(a => a.severity === "HIGH");
		const mediumAlerts = alerts.filter(a => a.severity === "MEDIUM");
		
		// Critical alerts should come first
		if (criticalAlerts.length > 0 && highAlerts.length > 0) {
			const firstCriticalIndex = alerts.findIndex(a => a.severity === "CRITICAL");
			const firstHighIndex = alerts.findIndex(a => a.severity === "HIGH");
			expect(firstCriticalIndex).toBeLessThan(firstHighIndex);
		}
	});

	test("Challenge 5b-2: Alert acknowledgment and management", async () => {
		// First get alerts
		const alertsResponse = await testSession
			.get("/api/dashboard/alerts")
			.set("Authorization", `Bearer ${authToken}`);

		expect(alertsResponse.status).toBe(HttpStatus.OK);
		const alerts = alertsResponse.body.data;
		expect(alerts.length).toBeGreaterThan(0);

		// Acknowledge an alert
		const alertToAcknowledge = alerts[0];
		const acknowledgeResponse = await testSession
			.post(`/api/dashboard/alerts/${alertToAcknowledge.id}/acknowledge`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ note: "Investigating this issue" });

		expect(acknowledgeResponse.status).toBe(HttpStatus.OK);
		expect(acknowledgeResponse.body.data.acknowledged).toBeTruthy();
		expect(acknowledgeResponse.body.data.acknowledgedBy).toBe(testUserId);
		expect(acknowledgeResponse.body.data.acknowledgedNote).toBe("Investigating this issue");

		// Verify acknowledged alert doesn't appear in active alerts
		const activeAlertsResponse = await testSession
			.get("/api/dashboard/alerts?status=active")
			.set("Authorization", `Bearer ${authToken}`);

		expect(activeAlertsResponse.status).toBe(HttpStatus.OK);
		const activeAlerts = activeAlertsResponse.body.data;
		const acknowledgedAlertInActive = activeAlerts.find(a => a.id === alertToAcknowledge.id);
		expect(acknowledgedAlertInActive).toBeUndefined();

		// But should appear in acknowledged alerts
		const acknowledgedAlertsResponse = await testSession
			.get("/api/dashboard/alerts?status=acknowledged")
			.set("Authorization", `Bearer ${authToken}`);

		expect(acknowledgedAlertsResponse.status).toBe(HttpStatus.OK);
		const acknowledgedAlerts = acknowledgedAlertsResponse.body.data;
		const acknowledgedAlert = acknowledgedAlerts.find(a => a.id === alertToAcknowledge.id);
		expect(acknowledgedAlert).toBeDefined();
		expect(acknowledgedAlert.acknowledged).toBeTruthy();

		// Test dismissing an alert
		const alertToDismiss = alerts[1];
		const dismissResponse = await testSession
			.post(`/api/dashboard/alerts/${alertToDismiss.id}/dismiss`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ reason: "False positive" });

		expect(dismissResponse.status).toBe(HttpStatus.OK);
		expect(dismissResponse.body.data.dismissed).toBeTruthy();
		expect(dismissResponse.body.data.dismissedBy).toBe(testUserId);
		expect(dismissResponse.body.data.dismissedReason).toBe("False positive");
	});

	// Challenge 6c: Real-time Updates
	test("Challenge 5c-1: Dashboard data freshness", async () => {
		// Get initial dashboard state
		const initialOverview = await testSession
			.get("/api/dashboard/overview")
			.set("Authorization", `Bearer ${authToken}`);

		expect(initialOverview.status).toBe(HttpStatus.OK);
		const initialData = initialOverview.body.data;

		// Make a stock update that should trigger dashboard changes
		const laptopProduct = testProducts.find(p => p.sku === "DASH-LAPTOP-001");
		const stockUpdateResponse = await testSession
			.put(`/api/product/${laptopProduct.id}/stock`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ quantity: 20, operation: "add" });

		expect(stockUpdateResponse.status).toBe(HttpStatus.OK);

		// Get updated dashboard state
		const updatedOverview = await testSession
			.get("/api/dashboard/overview")
			.set("Authorization", `Bearer ${authToken}`);

		expect(updatedOverview.status).toBe(HttpStatus.OK);
		const updatedData = updatedOverview.body.data;

		// Verify inventory value increased
		const expectedValueIncrease = 20 * laptopProduct.price;
		expect(updatedData.totalInventoryValue).toBeCloseTo(
			initialData.totalInventoryValue + expectedValueIncrease, 2
		);

		// Verify low stock count decreased (laptop is now above reorder level)
		expect(updatedData.lowStockProducts).toBe(initialData.lowStockProducts - 1);

		// Verify stock distribution changed
		const updatedDistribution = await testSession
			.get("/api/dashboard/stock-distribution")
			.set("Authorization", `Bearer ${authToken}`);

		expect(updatedDistribution.status).toBe(HttpStatus.OK);
		expect(updatedDistribution.body.data.lowStock).toBe(1); // Should be one less
		expect(updatedDistribution.body.data.normalStock).toBe(3); // Should be one more
	});

	test("Challenge 5c-2: Performance metrics tracking", async () => {
		// Get performance metrics
		const performanceResponse = await testSession
			.get("/api/dashboard/performance")
			.set("Authorization", `Bearer ${authToken}`);

		expect(performanceResponse.status).toBe(HttpStatus.OK);
		
		const performance = performanceResponse.body.data;
		
		// Verify response time metrics
		expect(performance.averageResponseTime).toBeDefined();
		expect(performance.averageResponseTime).toBeGreaterThan(0);
		expect(performance.averageResponseTime).toBeLessThan(1000); // Should be under 1 second

		// Verify database query metrics
		expect(performance.databaseMetrics).toBeDefined();
		expect(performance.databaseMetrics.averageQueryTime).toBeDefined();
		expect(performance.databaseMetrics.totalQueries).toBeDefined();
		expect(performance.databaseMetrics.slowQueries).toBeDefined();

		// Verify memory usage
		expect(performance.memoryUsage).toBeDefined();
		expect(performance.memoryUsage.used).toBeGreaterThan(0);
		expect(performance.memoryUsage.total).toBeGreaterThan(performance.memoryUsage.used);

		// Verify API endpoint statistics
		expect(performance.endpointStats).toBeDefined();
		expect(Array.isArray(performance.endpointStats)).toBeTruthy();
		
		if (performance.endpointStats.length > 0) {
			const endpointStat = performance.endpointStats[0];
			expect(endpointStat.endpoint).toBeDefined();
			expect(endpointStat.requestCount).toBeDefined();
			expect(endpointStat.averageResponseTime).toBeDefined();
			expect(endpointStat.errorRate).toBeDefined();
		}

		// Verify system health indicators
		expect(performance.healthScore).toBeDefined();
		expect(performance.healthScore).toBeGreaterThanOrEqual(0);
		expect(performance.healthScore).toBeLessThanOrEqual(100);
	});

	// Challenge 5d: Export and Reporting
	test("Challenge 5d-1: Data export functionality", async () => {
		// Test CSV export
		const csvExportResponse = await testSession
			.get("/api/dashboard/export?format=csv&type=inventory")
			.set("Authorization", `Bearer ${authToken}`);

		expect(csvExportResponse.status).toBe(HttpStatus.OK);
		expect(csvExportResponse.headers['content-type']).toContain('text/csv');
		expect(csvExportResponse.headers['content-disposition']).toContain('attachment');
		expect(csvExportResponse.headers['content-disposition']).toContain('inventory');

		// Verify CSV content structure
		const csvContent = csvExportResponse.text;
		const lines = csvContent.split('\n').filter(line => line.trim());
		expect(lines.length).toBeGreaterThan(1); // Header + data lines
		
		// Verify CSV headers
		const headers = lines[0].split(',');
		expect(headers).toContain('SKU');
		expect(headers).toContain('Name');
		expect(headers).toContain('Price');
		expect(headers).toContain('Stock Quantity');
		expect(headers).toContain('Category');

		// Test JSON export
		const jsonExportResponse = await testSession
			.get("/api/dashboard/export?format=json&type=analytics")
			.set("Authorization", `Bearer ${authToken}`);

		expect(jsonExportResponse.status).toBe(HttpStatus.OK);
		expect(jsonExportResponse.headers['content-type']).toContain('application/json');
		
		const jsonData = jsonExportResponse.body;
		expect(jsonData.overview).toBeDefined();
		expect(jsonData.categories).toBeDefined();
		expect(jsonData.stockDistribution).toBeDefined();
		expect(jsonData.alerts).toBeDefined();
		expect(jsonData.exportTimestamp).toBeDefined();

		// Test Excel export
		const excelExportResponse = await testSession
			.get("/api/dashboard/export?format=excel&type=full")
			.set("Authorization", `Bearer ${authToken}`);

		expect(excelExportResponse.status).toBe(HttpStatus.OK);
		expect(excelExportResponse.headers['content-type']).toContain('application/vnd.openxmlformats');
		expect(excelExportResponse.headers['content-disposition']).toContain('.xlsx');

		// Test invalid export format
		const invalidFormatResponse = await testSession
			.get("/api/dashboard/export?format=invalid&type=inventory")
			.set("Authorization", `Bearer ${authToken}`);

		expect(invalidFormatResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(invalidFormatResponse.body.message).toContain("unsupported export format");
	});

	test("Challenge 5d-2: Scheduled report generation", async () => {
		// Create a scheduled report
		const reportConfig = {
			name: "Weekly Inventory Report",
			type: "inventory",
			format: "pdf",
			schedule: "weekly",
			recipients: ["dashboard@example.com"],
			includeCharts: true,
			filters: {
				categories: ["electronics", "audio"],
				stockLevel: "low"
			}
		};

		const createReportResponse = await testSession
			.post("/api/dashboard/reports/schedule")
			.set("Authorization", `Bearer ${authToken}`)
			.send(reportConfig);

		expect(createReportResponse.status).toBe(HttpStatus.CREATED);
		
		const createdReport = createReportResponse.body.data;
		expect(createdReport.id).toBeDefined();
		expect(createdReport.name).toBe(reportConfig.name);
		expect(createdReport.schedule).toBe(reportConfig.schedule);
		expect(createdReport.status).toBe("active");
		expect(createdReport.createdBy).toBe(testUserId);

		// Get list of scheduled reports
		const reportsListResponse = await testSession
			.get("/api/dashboard/reports/scheduled")
			.set("Authorization", `Bearer ${authToken}`);

		expect(reportsListResponse.status).toBe(HttpStatus.OK);
		const reports = reportsListResponse.body.data;
		expect(reports.length).toBe(1);
		expect(reports[0].id).toBe(createdReport.id);

		// Generate report on demand
		const generateReportResponse = await testSession
			.post(`/api/dashboard/reports/${createdReport.id}/generate`)
			.set("Authorization", `Bearer ${authToken}`);

		expect(generateReportResponse.status).toBe(HttpStatus.OK);
		expect(generateReportResponse.body.data.status).toBe("generated");
		expect(generateReportResponse.body.data.downloadUrl).toBeDefined();

		// Update scheduled report
		const updateReportResponse = await testSession
			.put(`/api/dashboard/reports/${createdReport.id}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({ 
				schedule: "daily",
				recipients: ["dashboard@example.com", "manager@example.com"]
			});

		expect(updateReportResponse.status).toBe(HttpStatus.OK);
		expect(updateReportResponse.body.data.schedule).toBe("daily");
		expect(updateReportResponse.body.data.recipients.length).toBe(2);

		// Deactivate scheduled report
		const deactivateReportResponse = await testSession
			.put(`/api/dashboard/reports/${createdReport.id}/deactivate`)
			.set("Authorization", `Bearer ${authToken}`);

		expect(deactivateReportResponse.status).toBe(HttpStatus.OK);
		expect(deactivateReportResponse.body.data.status).toBe("inactive");
	});
});
