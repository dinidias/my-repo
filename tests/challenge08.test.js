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

describe("Challenge 08: Data Analytics Engine", () => {
	
	let authToken = null;
	let testUserId = null;
	let analyticsProducts = [];

	beforeEach(async () => {
		// Create a test user and get auth token
		const userData = {
			firstName: "Analytics",
			lastName: "Tester",
			email: "analytics@example.com",
			password: "AnalyticsPass123!"
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

		// Create comprehensive test data for analytics
		const categories = ["electronics", "books", "clothing", "sports", "home"];
		const suppliers = ["supplier-A", "supplier-B", "supplier-C", "supplier-D"];
		
		analyticsProducts = [];
		
		// Create products with historical data simulation
		for (let i = 1; i <= 50; i++) {
			const product = {
				name: `Analytics Product ${i.toString().padStart(2, '0')}`,
				sku: `ANALYTICS-${i.toString().padStart(2, '0')}`,
				price: Math.floor(Math.random() * 500) + 20,
				stockQuantity: Math.floor(Math.random() * 200) + 10,
				reorderLevel: Math.floor(Math.random() * 30) + 5,
				category: categories[i % categories.length],
				supplierId: suppliers[i % suppliers.length],
				description: `Analytics test product with comprehensive data for testing`
			};

			const response = await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);

			expect(response.status).toBe(HttpStatus.CREATED);
			analyticsProducts.push(response.body.data);
		}

		// Simulate some stock movements and sales data
		for (let i = 0; i < 10; i++) {
			const product = analyticsProducts[i];
			
			// Simulate stock movements
			await testSession
				.put(`/api/product/${product.id}/stock`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					quantity: Math.floor(Math.random() * 20) + 1,
					operation: "subtract" // Simulate sales
				});
				
			// Add some stock back
			await testSession
				.put(`/api/product/${product.id}/stock`)
				.set("Authorization", `Bearer ${authToken}`)
				.send({
					quantity: Math.floor(Math.random() * 50) + 10,
					operation: "add" // Simulate restocking
				});
		}
	});

	// Challenge 8a: Advanced Aggregations
	test("Challenge 8a-1: Multi-dimensional analytics aggregations", async () => {
		// Test comprehensive analytics aggregation
		const analyticsResponse = await testSession
			.get("/api/analytics/aggregation")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				groupBy: "category,supplier",
				metrics: "total_value,avg_price,product_count,stock_turnover",
				timeframe: "last_30_days"
			});

		expect(analyticsResponse.status).toBe(HttpStatus.OK);
		
		const aggregations = analyticsResponse.body.data;
		expect(Array.isArray(aggregations)).toBeTruthy();
		expect(aggregations.length).toBeGreaterThan(0);

		// Verify aggregation structure
		aggregations.forEach(agg => {
			expect(agg.category).toBeDefined();
			expect(agg.supplier).toBeDefined();
			expect(agg.metrics).toBeDefined();
			expect(agg.metrics.total_value).toBeDefined();
			expect(agg.metrics.avg_price).toBeDefined();
			expect(agg.metrics.product_count).toBeDefined();
			expect(agg.metrics.stock_turnover).toBeDefined();
		});

		// Test category-only aggregation
		const categoryAnalyticsResponse = await testSession
			.get("/api/analytics/aggregation")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				groupBy: "category",
				metrics: "total_value,product_count",
				sortBy: "total_value",
				sortOrder: "desc"
			});

		expect(categoryAnalyticsResponse.status).toBe(HttpStatus.OK);
		
		const categoryAggs = categoryAnalyticsResponse.body.data;
		expect(categoryAggs.length).toBe(5); // 5 categories

		// Verify sorting (descending by total_value)
		for (let i = 1; i < categoryAggs.length; i++) {
			expect(categoryAggs[i].metrics.total_value)
				.toBeLessThanOrEqual(categoryAggs[i-1].metrics.total_value);
		}

		// Test time-based aggregation
		const timeAnalyticsResponse = await testSession
			.get("/api/analytics/aggregation")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				groupBy: "date",
				metrics: "total_sales,stock_changes",
				timeframe: "last_7_days",
				interval: "daily"
			});

		expect(timeAnalyticsResponse.status).toBe(HttpStatus.OK);
		expect(timeAnalyticsResponse.body.data.length).toBeLessThanOrEqual(7);
	});

	test("Challenge 8a-2: Custom metric calculations", async () => {
		// Test custom calculated metrics
		const customMetricsResponse = await testSession
			.get("/api/analytics/custom-metrics")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				metrics: [
					"inventory_turnover_ratio",
					"stock_efficiency_score", 
					"profit_margin_trend",
					"reorder_accuracy_rate",
					"category_performance_index"
				].join(",")
			});

		expect(customMetricsResponse.status).toBe(HttpStatus.OK);
		
		const metrics = customMetricsResponse.body.data;
		
		// Verify inventory turnover ratio calculation
		expect(metrics.inventory_turnover_ratio).toBeDefined();
		expect(typeof metrics.inventory_turnover_ratio).toBe("number");
		expect(metrics.inventory_turnover_ratio).toBeGreaterThan(0);

		// Verify stock efficiency score (0-100 scale)
		expect(metrics.stock_efficiency_score).toBeDefined();
		expect(metrics.stock_efficiency_score).toBeGreaterThanOrEqual(0);
		expect(metrics.stock_efficiency_score).toBeLessThanOrEqual(100);

		// Verify profit margin trend
		expect(metrics.profit_margin_trend).toBeDefined();
		expect(typeof metrics.profit_margin_trend).toBe("object");
		expect(metrics.profit_margin_trend.current_margin).toBeDefined();
		expect(metrics.profit_margin_trend.trend_direction).toBeDefined();
		expect(["up", "down", "stable"]).toContain(metrics.profit_margin_trend.trend_direction);

		// Verify reorder accuracy rate
		expect(metrics.reorder_accuracy_rate).toBeDefined();
		expect(metrics.reorder_accuracy_rate).toBeGreaterThanOrEqual(0);
		expect(metrics.reorder_accuracy_rate).toBeLessThanOrEqual(100);

		// Verify category performance index
		expect(metrics.category_performance_index).toBeDefined();
		expect(Array.isArray(metrics.category_performance_index)).toBeTruthy();
		
		metrics.category_performance_index.forEach(categoryIndex => {
			expect(categoryIndex.category).toBeDefined();
			expect(categoryIndex.performance_score).toBeDefined();
			expect(categoryIndex.ranking).toBeDefined();
		});

		// Test metric calculation with filters
		const filteredMetricsResponse = await testSession
			.get("/api/analytics/custom-metrics")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				metrics: "category_performance_index",
				category: "electronics,books",
				min_price: 50,
				max_price: 300
			});

		expect(filteredMetricsResponse.status).toBe(HttpStatus.OK);
		
		const filteredMetrics = filteredMetricsResponse.body.data;
		expect(filteredMetrics.category_performance_index.length).toBeLessThanOrEqual(2);
	});

	test("Challenge 8a-3: Statistical analysis and correlations", async () => {
		// Test statistical analysis endpoints
		const statsResponse = await testSession
			.get("/api/analytics/statistics")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				analysis_type: "correlation",
				variables: "price,stock_quantity,reorder_level",
				include_regression: true
			});

		expect(statsResponse.status).toBe(HttpStatus.OK);
		
		const stats = statsResponse.body.data;
		
		// Verify correlation matrix
		expect(stats.correlation_matrix).toBeDefined();
		expect(stats.correlation_matrix.price_stock_quantity).toBeDefined();
		expect(stats.correlation_matrix.price_reorder_level).toBeDefined();
		expect(stats.correlation_matrix.stock_quantity_reorder_level).toBeDefined();

		// Correlation values should be between -1 and 1
		Object.values(stats.correlation_matrix).forEach(correlation => {
			expect(correlation).toBeGreaterThanOrEqual(-1);
			expect(correlation).toBeLessThanOrEqual(1);
		});

		// Verify regression analysis
		if (stats.regression_analysis) {
			expect(stats.regression_analysis.r_squared).toBeDefined();
			expect(stats.regression_analysis.coefficients).toBeDefined();
			expect(stats.regression_analysis.p_values).toBeDefined();
		}

		// Test distribution analysis
		const distributionResponse = await testSession
			.get("/api/analytics/statistics")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				analysis_type: "distribution",
				variable: "price",
				include_outliers: true
			});

		expect(distributionResponse.status).toBe(HttpStatus.OK);
		
		const distribution = distributionResponse.body.data;
		expect(distribution.mean).toBeDefined();
		expect(distribution.median).toBeDefined();
		expect(distribution.mode).toBeDefined();
		expect(distribution.standard_deviation).toBeDefined();
		expect(distribution.variance).toBeDefined();
		expect(distribution.skewness).toBeDefined();
		expect(distribution.kurtosis).toBeDefined();
		
		if (distribution.outliers) {
			expect(Array.isArray(distribution.outliers)).toBeTruthy();
		}

		// Test trend analysis
		const trendResponse = await testSession
			.get("/api/analytics/statistics")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				analysis_type: "trend",
				variable: "stock_movements",
				timeframe: "last_30_days",
				trend_method: "linear"
			});

		expect(trendResponse.status).toBe(HttpStatus.OK);
		
		const trend = trendResponse.body.data;
		expect(trend.trend_direction).toBeDefined();
		expect(["increasing", "decreasing", "stable"]).toContain(trend.trend_direction);
		expect(trend.trend_strength).toBeDefined();
		expect(trend.slope).toBeDefined();
		expect(trend.confidence_interval).toBeDefined();
	});

	// Challenge 8b: Predictive Analytics
	test("Challenge 8b-1: Demand forecasting", async () => {
		// Test demand forecasting functionality
		const forecastResponse = await testSession
			.get("/api/analytics/forecast/demand")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				product_ids: analyticsProducts.slice(0, 5).map(p => p.id).join(","),
				forecast_period: 30, // 30 days
				model: "linear_regression",
				include_seasonality: true,
				confidence_level: 0.95
			});

		expect(forecastResponse.status).toBe(HttpStatus.OK);
		
		const forecast = forecastResponse.body.data;
		expect(Array.isArray(forecast)).toBeTruthy();
		expect(forecast.length).toBe(5);

		forecast.forEach(productForecast => {
			expect(productForecast.product_id).toBeDefined();
			expect(productForecast.predictions).toBeDefined();
			expect(Array.isArray(productForecast.predictions)).toBeTruthy();
			expect(productForecast.predictions.length).toBe(30); // 30 days

			productForecast.predictions.forEach(prediction => {
				expect(prediction.date).toBeDefined();
				expect(prediction.predicted_demand).toBeDefined();
				expect(prediction.confidence_lower).toBeDefined();
				expect(prediction.confidence_upper).toBeDefined();
				expect(prediction.predicted_demand).toBeGreaterThanOrEqual(0);
			});

			// Verify model performance metrics
			expect(productForecast.model_metrics).toBeDefined();
			expect(productForecast.model_metrics.mape).toBeDefined(); // Mean Absolute Percentage Error
			expect(productForecast.model_metrics.rmse).toBeDefined(); // Root Mean Square Error
			expect(productForecast.model_metrics.r_squared).toBeDefined();
		});

		// Test category-level forecasting
		const categoryForecastResponse = await testSession
			.get("/api/analytics/forecast/demand")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				category: "electronics",
				forecast_period: 14,
				model: "arima",
				aggregation_level: "category"
			});

		expect(categoryForecastResponse.status).toBe(HttpStatus.OK);
		
		const categoryForecast = categoryForecastResponse.body.data;
		expect(categoryForecast.category).toBe("electronics");
		expect(categoryForecast.predictions).toBeDefined();
		expect(categoryForecast.predictions.length).toBe(14);
	});

	test("Challenge 8b-2: Stock optimization recommendations", async () => {
		// Test stock optimization algorithm
		const optimizationResponse = await testSession
			.get("/api/analytics/optimization/stock")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				optimization_goal: "minimize_carrying_cost",
				constraints: "service_level:0.95,budget:50000",
				time_horizon: 90,
				include_supplier_lead_times: true
			});

		expect(optimizationResponse.status).toBe(HttpStatus.OK);
		
		const optimization = optimizationResponse.body.data;
		expect(optimization.recommendations).toBeDefined();
		expect(Array.isArray(optimization.recommendations)).toBeTruthy();

		optimization.recommendations.forEach(rec => {
			expect(rec.product_id).toBeDefined();
			expect(rec.current_stock).toBeDefined();
			expect(rec.recommended_stock).toBeDefined();
			expect(rec.reorder_point).toBeDefined();
			expect(rec.order_quantity).toBeDefined();
			expect(rec.reason).toBeDefined();
			expect(rec.impact_score).toBeDefined();
			expect(rec.priority).toBeDefined();
			expect(["high", "medium", "low"]).toContain(rec.priority);
		});

		// Verify optimization objectives
		expect(optimization.optimization_results).toBeDefined();
		expect(optimization.optimization_results.total_carrying_cost).toBeDefined();
		expect(optimization.optimization_results.service_level_achieved).toBeDefined();
		expect(optimization.optimization_results.total_investment_required).toBeDefined();
		expect(optimization.optimization_results.cost_savings_potential).toBeDefined();

		// Test different optimization goals
		const revenueOptimizationResponse = await testSession
			.get("/api/analytics/optimization/stock")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				optimization_goal: "maximize_revenue",
				constraints: "storage_capacity:1000,budget:75000",
				focus_categories: "electronics,books"
			});

		expect(revenueOptimizationResponse.status).toBe(HttpStatus.OK);
		
		const revenueOptimization = revenueOptimizationResponse.body.data;
		expect(revenueOptimization.recommendations).toBeDefined();
		expect(revenueOptimization.optimization_results.projected_revenue_increase).toBeDefined();
	});

	test("Challenge 8b-3: Anomaly detection", async () => {
		// Test anomaly detection in inventory patterns
		const anomalyResponse = await testSession
			.get("/api/analytics/anomaly-detection")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				detection_type: "inventory_patterns",
				sensitivity: "medium",
				timeframe: "last_30_days",
				include_predictions: true
			});

		expect(anomalyResponse.status).toBe(HttpStatus.OK);
		
		const anomalies = anomalyResponse.body.data;
		expect(anomalies.detected_anomalies).toBeDefined();
		expect(Array.isArray(anomalies.detected_anomalies)).toBeTruthy();

		anomalies.detected_anomalies.forEach(anomaly => {
			expect(anomaly.product_id).toBeDefined();
			expect(anomaly.anomaly_type).toBeDefined();
			expect(["sudden_spike", "unexpected_drop", "irregular_pattern", "seasonal_deviation"]).toContain(anomaly.anomaly_type);
			expect(anomaly.detected_at).toBeDefined();
			expect(anomaly.severity_score).toBeDefined();
			expect(anomaly.severity_score).toBeGreaterThanOrEqual(0);
			expect(anomaly.severity_score).toBeLessThanOrEqual(100);
			expect(anomaly.description).toBeDefined();
			expect(anomaly.suggested_actions).toBeDefined();
			expect(Array.isArray(anomaly.suggested_actions)).toBeTruthy();
		});

		// Test price anomaly detection
		const priceAnomalyResponse = await testSession
			.get("/api/analytics/anomaly-detection")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				detection_type: "price_patterns",
				comparison_method: "statistical",
				include_competitor_analysis: false
			});

		expect(priceAnomalyResponse.status).toBe(HttpStatus.OK);
		
		const priceAnomalies = priceAnomalyResponse.body.data;
		expect(priceAnomalies.detected_anomalies).toBeDefined();

		// Test demand anomaly detection
		const demandAnomalyResponse = await testSession
			.get("/api/analytics/anomaly-detection")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				detection_type: "demand_patterns",
				algorithm: "isolation_forest",
				seasonal_adjustment: true
			});

		expect(demandAnomalyResponse.status).toBe(HttpStatus.OK);
		
		const demandAnomalies = demandAnomalyResponse.body.data;
		expect(demandAnomalies.algorithm_performance).toBeDefined();
		expect(demandAnomalies.algorithm_performance.accuracy).toBeDefined();
		expect(demandAnomalies.algorithm_performance.false_positive_rate).toBeDefined();
	});

	// Challenge 8c: Business Intelligence
	test("Challenge 8c-1: Advanced KPI calculations", async () => {
		// Test comprehensive KPI dashboard
		const kpiResponse = await testSession
			.get("/api/analytics/kpi/comprehensive")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				timeframe: "last_quarter",
				include_benchmarks: true,
				compare_previous_period: true
			});

		expect(kpiResponse.status).toBe(HttpStatus.OK);
		
		const kpis = kpiResponse.body.data;
		
		// Financial KPIs
		expect(kpis.financial_kpis).toBeDefined();
		expect(kpis.financial_kpis.gross_margin).toBeDefined();
		expect(kpis.financial_kpis.inventory_turnover).toBeDefined();
		expect(kpis.financial_kpis.carrying_cost_ratio).toBeDefined();
		expect(kpis.financial_kpis.dead_stock_percentage).toBeDefined();

		// Operational KPIs
		expect(kpis.operational_kpis).toBeDefined();
		expect(kpis.operational_kpis.stockout_rate).toBeDefined();
		expect(kpis.operational_kpis.order_fulfillment_rate).toBeDefined();
		expect(kpis.operational_kpis.average_order_processing_time).toBeDefined();
		expect(kpis.operational_kpis.supplier_performance_score).toBeDefined();

		// Strategic KPIs
		expect(kpis.strategic_kpis).toBeDefined();
		expect(kpis.strategic_kpis.market_share_growth).toBeDefined();
		expect(kpis.strategic_kpis.customer_satisfaction_score).toBeDefined();
		expect(kpis.strategic_kpis.product_mix_optimization_score).toBeDefined();

		// Verify period comparison
		if (kpis.period_comparison) {
			expect(kpis.period_comparison.current_period).toBeDefined();
			expect(kpis.period_comparison.previous_period).toBeDefined();
			expect(kpis.period_comparison.percentage_changes).toBeDefined();
		}

		// Verify benchmarks
		if (kpis.industry_benchmarks) {
			expect(kpis.industry_benchmarks.inventory_turnover_benchmark).toBeDefined();
			expect(kpis.industry_benchmarks.gross_margin_benchmark).toBeDefined();
			expect(kpis.performance_vs_benchmark).toBeDefined();
		}
	});

	test("Challenge 8c-2: Cohort analysis", async () => {
		// Test customer/product cohort analysis
		const cohortResponse = await testSession
			.get("/api/analytics/cohort-analysis")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				cohort_type: "product_introduction",
				metric: "revenue_retention",
				period_type: "monthly",
				periods: 12
			});

		expect(cohortResponse.status).toBe(HttpStatus.OK);
		
		const cohortAnalysis = cohortResponse.body.data;
		expect(cohortAnalysis.cohort_table).toBeDefined();
		expect(Array.isArray(cohortAnalysis.cohort_table)).toBeTruthy();

		cohortAnalysis.cohort_table.forEach(cohort => {
			expect(cohort.cohort_group).toBeDefined();
			expect(cohort.period_0).toBeDefined(); // Initial period
			expect(Array.isArray(cohort.retention_rates)).toBeTruthy();
			expect(cohort.retention_rates.length).toBeLessThanOrEqual(12);
		});

		// Verify cohort insights
		expect(cohortAnalysis.insights).toBeDefined();
		expect(cohortAnalysis.insights.strongest_cohort).toBeDefined();
		expect(cohortAnalysis.insights.weakest_cohort).toBeDefined();
		expect(cohortAnalysis.insights.average_retention_rate).toBeDefined();
		expect(cohortAnalysis.insights.churn_patterns).toBeDefined();

		// Test supplier cohort analysis
		const supplierCohortResponse = await testSession
			.get("/api/analytics/cohort-analysis")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				cohort_type: "supplier_performance",
				metric: "quality_score",
				period_type: "quarterly",
				periods: 4
			});

		expect(supplierCohortResponse.status).toBe(HttpStatus.OK);
		
		const supplierCohort = supplierCohortResponse.body.data;
		expect(supplierCohort.cohort_table).toBeDefined();
		expect(supplierCohort.performance_trends).toBeDefined();
	});

	// Challenge 8d: Real-time Analytics
	test("Challenge 8d-1: Streaming analytics processing", async () => {
		// Test real-time analytics stream processing
		const streamAnalyticsResponse = await testSession
			.get("/api/analytics/real-time/stream")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				stream_type: "inventory_changes",
				window_size: "5_minutes",
				aggregations: "count,sum,avg,min,max",
				include_alerts: true
			});

		expect(streamAnalyticsResponse.status).toBe(HttpStatus.OK);
		
		const streamData = streamAnalyticsResponse.body.data;
		expect(streamData.current_window).toBeDefined();
		expect(streamData.current_window.start_time).toBeDefined();
		expect(streamData.current_window.end_time).toBeDefined();
		expect(streamData.current_window.metrics).toBeDefined();

		const metrics = streamData.current_window.metrics;
		expect(metrics.total_events).toBeDefined();
		expect(metrics.events_per_second).toBeDefined();
		expect(metrics.unique_products_affected).toBeDefined();
		expect(metrics.total_value_changed).toBeDefined();

		// Verify sliding window data
		expect(streamData.sliding_windows).toBeDefined();
		expect(Array.isArray(streamData.sliding_windows)).toBeTruthy();
		expect(streamData.sliding_windows.length).toBeLessThanOrEqual(12); // Last 12 windows

		// Test real-time alerts
		if (streamData.active_alerts) {
			expect(Array.isArray(streamData.active_alerts)).toBeTruthy();
			streamData.active_alerts.forEach(alert => {
				expect(alert.alert_type).toBeDefined();
				expect(alert.severity).toBeDefined();
				expect(alert.triggered_at).toBeDefined();
				expect(alert.condition).toBeDefined();
				expect(alert.current_value).toBeDefined();
				expect(alert.threshold).toBeDefined();
			});
		}

		// Test event stream subscription
		const subscriptionResponse = await testSession
			.post("/api/analytics/real-time/subscribe")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				event_types: ["stock_update", "price_change", "new_product"],
				filters: {
					categories: ["electronics", "books"],
					min_value_threshold: 100
				},
				delivery_method: "webhook",
				webhook_url: "https://test-webhook.example.com/analytics"
			});

		expect(subscriptionResponse.status).toBe(HttpStatus.CREATED);
		expect(subscriptionResponse.body.data.subscription_id).toBeDefined();
		expect(subscriptionResponse.body.data.status).toBe("active");
	});

	test("Challenge 8d-2: Complex event processing", async () => {
		// Test complex event pattern detection
		const cepResponse = await testSession
			.get("/api/analytics/complex-events")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				pattern_type: "rapid_stock_depletion",
				time_window: "1_hour",
				threshold_conditions: "stock_decrease:50,frequency:5",
				include_correlations: true
			});

		expect(cepResponse.status).toBe(HttpStatus.OK);
		
		const complexEvents = cepResponse.body.data;
		expect(complexEvents.detected_patterns).toBeDefined();
		expect(Array.isArray(complexEvents.detected_patterns)).toBeTruthy();

		complexEvents.detected_patterns.forEach(pattern => {
			expect(pattern.pattern_id).toBeDefined();
			expect(pattern.pattern_type).toBeDefined();
			expect(pattern.start_time).toBeDefined();
			expect(pattern.end_time).toBeDefined();
			expect(pattern.involved_products).toBeDefined();
			expect(Array.isArray(pattern.involved_products)).toBeTruthy();
			expect(pattern.confidence_score).toBeDefined();
			expect(pattern.impact_assessment).toBeDefined();
		});

		// Test custom pattern definition
		const customPatternResponse = await testSession
			.post("/api/analytics/complex-events/patterns")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				pattern_name: "price_volatility_cascade",
				pattern_definition: {
					events: [
						{
							type: "price_change",
							conditions: { change_percentage: { ">": 10 } },
							alias: "initial_spike"
						},
						{
							type: "competitor_price_change",
							conditions: { reaction_time: { "<": "2_hours" } },
							alias: "competitor_reaction"
						},
						{
							type: "demand_spike",
							conditions: { increase_percentage: { ">": 25 } },
							alias: "demand_response"
						}
					],
					sequence: ["initial_spike", "competitor_reaction", "demand_response"],
					time_window: "24_hours",
					correlation_threshold: 0.7
				},
				actions: [
					{
						type: "alert",
						severity: "high",
						recipients: ["inventory@company.com"]
					},
					{
						type: "auto_reorder",
						conditions: { stock_level: { "<": "reorder_threshold" } }
					}
				]
			});

		expect(customPatternResponse.status).toBe(HttpStatus.CREATED);
		expect(customPatternResponse.body.data.pattern_id).toBeDefined();
		expect(customPatternResponse.body.data.status).toBe("active");

		// Test pattern matching accuracy
		const patternAccuracyResponse = await testSession
			.get("/api/analytics/complex-events/accuracy")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				pattern_id: customPatternResponse.body.data.pattern_id,
				test_period: "last_7_days"
			});

		expect(patternAccuracyResponse.status).toBe(HttpStatus.OK);
		
		const accuracy = patternAccuracyResponse.body.data;
		expect(accuracy.true_positives).toBeDefined();
		expect(accuracy.false_positives).toBeDefined();
		expect(accuracy.false_negatives).toBeDefined();
		expect(accuracy.precision).toBeDefined();
		expect(accuracy.recall).toBeDefined();
		expect(accuracy.f1_score).toBeDefined();
	});
});
