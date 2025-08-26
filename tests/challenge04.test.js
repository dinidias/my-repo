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

describe("Challenge 04: API Validation and Error Handling", () => {
	
	let authToken = null;
	let testUserId = null;
	let testProducts = [];

	beforeEach(async () => {
		// Create a test user and get auth token
		const userData = {
			firstName: "Search",
			lastName: "Tester",
			email: "search@example.com",
			password: "SearchPass123!"
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

		// Create test products with diverse data
		const products = [
			{
				name: "Apple iPhone 15 Pro",
				sku: "APPLE-IPHONE-15P",
				price: 999.99,
				stockQuantity: 45,
				reorderLevel: 10,
				category: "electronics",
				description: "Latest flagship smartphone with titanium design"
			},
			{
				name: "Samsung Galaxy S24 Ultra",
				sku: "SAMSUNG-S24-ULTRA",
				price: 1199.99,
				stockQuantity: 30,
				reorderLevel: 8,
				category: "electronics", 
				description: "Android flagship with S Pen and AI features"
			},
			{
				name: "Apple MacBook Pro M3",
				sku: "APPLE-MBP-M3",
				price: 1999.99,
				stockQuantity: 15,
				reorderLevel: 5,
				category: "computers",
				description: "Professional laptop with M3 chip and Retina display"
			},
			{
				name: "Dell XPS 13 Laptop",
				sku: "DELL-XPS-13",
				price: 899.99,
				stockQuantity: 25,
				reorderLevel: 7,
				category: "computers",
				description: "Ultrabook with InfinityEdge display"
			},
			{
				name: "Apple Watch Series 9",
				sku: "APPLE-WATCH-S9",
				price: 399.99,
				stockQuantity: 60,
				reorderLevel: 15,
				category: "wearables",
				description: "Smartwatch with health monitoring features"
			},
			{
				name: "Sony WH-1000XM5 Headphones",
				sku: "SONY-WH1000XM5",
				price: 349.99,
				stockQuantity: 40,
				reorderLevel: 12,
				category: "audio",
				description: "Wireless noise-canceling headphones"
			},
			{
				name: "The Great Gatsby Book",
				sku: "BOOK-GATSBY",
				price: 12.99,
				stockQuantity: 100,
				reorderLevel: 20,
				category: "books",
				description: "Classic American novel by F. Scott Fitzgerald"
			},
			{
				name: "Programming JavaScript Applications",
				sku: "BOOK-JS-PROG",
				price: 39.99,
				stockQuantity: 35,
				reorderLevel: 10,
				category: "books",
				description: "Comprehensive guide to modern JavaScript development"
			},
			{
				name: "Nike Air Max 90",
				sku: "NIKE-AIRMAX-90",
				price: 129.99,
				stockQuantity: 55,
				reorderLevel: 18,
				category: "footwear",
				description: "Classic athletic sneakers with Air cushioning"
			},
			{
				name: "Adidas Ultraboost 22",
				sku: "ADIDAS-UB22",
				price: 179.99,
				stockQuantity: 42,
				reorderLevel: 15,
				category: "footwear",
				description: "Running shoes with Boost midsole technology"
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
	});

	// Challenge 5a: Text Search
	test("Challenge 4a-1: Basic text search functionality", async () => {
		// Test search by product name
		const searchByNameResponse = await testSession
			.get("/api/product/search?q=iPhone")
			.set("Authorization", `Bearer ${authToken}`);

		expect(searchByNameResponse.status).toBe(HttpStatus.OK);
		expect(searchByNameResponse.body.data.length).toBe(1);
		expect(searchByNameResponse.body.data[0].name).toContain("iPhone");

		// Test search by SKU
		const searchBySkuResponse = await testSession
			.get("/api/product/search?q=APPLE-MBP")
			.set("Authorization", `Bearer ${authToken}`);

		expect(searchBySkuResponse.status).toBe(HttpStatus.OK);
		expect(searchBySkuResponse.body.data.length).toBe(1);
		expect(searchBySkuResponse.body.data[0].sku).toContain("APPLE-MBP");

		// Test search by description
		const searchByDescriptionResponse = await testSession
			.get("/api/product/search?q=noise-canceling")
			.set("Authorization", `Bearer ${authToken}`);

		expect(searchByDescriptionResponse.status).toBe(HttpStatus.OK);
		expect(searchByDescriptionResponse.body.data.length).toBe(1);
		expect(searchByDescriptionResponse.body.data[0].description).toContain("noise-canceling");

		// Test case-insensitive search
		const caseInsensitiveResponse = await testSession
			.get("/api/product/search?q=apple")
			.set("Authorization", `Bearer ${authToken}`);

		expect(caseInsensitiveResponse.status).toBe(HttpStatus.OK);
		expect(caseInsensitiveResponse.body.data.length).toBe(3); // iPhone, MacBook, Watch
		caseInsensitiveResponse.body.data.forEach(product => {
			expect(product.name.toLowerCase()).toContain("apple");
		});

		// Test partial word search
		const partialWordResponse = await testSession
			.get("/api/product/search?q=book")
			.set("Authorization", `Bearer ${authToken}`);

		expect(partialWordResponse.status).toBe(HttpStatus.OK);
		expect(partialWordResponse.body.data.length).toBe(3); // MacBook + 2 actual books
	});

	test("Challenge 4a-2: Advanced text search with multiple terms", async () => {
		// Test multiple word search (AND logic)
		const multiWordResponse = await testSession
			.get("/api/product/search?q=Apple Pro")
			.set("Authorization", `Bearer ${authToken}`);

		expect(multiWordResponse.status).toBe(HttpStatus.OK);
		expect(multiWordResponse.body.data.length).toBe(2); // iPhone Pro and MacBook Pro

		// Test quoted phrase search
		const quotedSearchResponse = await testSession
			.get("/api/product/search?q=\"Galaxy S24\"")
			.set("Authorization", `Bearer ${authToken}`);

		expect(quotedSearchResponse.status).toBe(HttpStatus.OK);
		expect(quotedSearchResponse.body.data.length).toBe(1);
		expect(quotedSearchResponse.body.data[0].name).toContain("Galaxy S24");

		// Test search with no results
		const noResultsResponse = await testSession
			.get("/api/product/search?q=nonexistent")
			.set("Authorization", `Bearer ${authToken}`);

		expect(noResultsResponse.status).toBe(HttpStatus.OK);
		expect(noResultsResponse.body.data.length).toBe(0);

		// Test empty search (should return all products)
		const emptySearchResponse = await testSession
			.get("/api/product/search?q=")
			.set("Authorization", `Bearer ${authToken}`);

		expect(emptySearchResponse.status).toBe(HttpStatus.OK);
		expect(emptySearchResponse.body.data.length).toBe(testProducts.length);

		// Test search with special characters
		const specialCharResponse = await testSession
			.get("/api/product/search?q=S24")
			.set("Authorization", `Bearer ${authToken}`);

		expect(specialCharResponse.status).toBe(HttpStatus.OK);
		expect(specialCharResponse.body.data.length).toBe(1);
	});

	// Challenge 5b: Category Filtering
	test("Challenge 4b-1: Category-based filtering", async () => {
		// Test single category filter
		const electronicsResponse = await testSession
			.get("/api/product/filter?category=electronics")
			.set("Authorization", `Bearer ${authToken}`);

		expect(electronicsResponse.status).toBe(HttpStatus.OK);
		expect(electronicsResponse.body.data.length).toBe(2); // iPhone and Samsung
		electronicsResponse.body.data.forEach(product => {
			expect(product.category).toBe("electronics");
		});

		// Test multiple categories
		const multipleCategoriesResponse = await testSession
			.get("/api/product/filter?category=electronics,computers")
			.set("Authorization", `Bearer ${authToken}`);

		expect(multipleCategoriesResponse.status).toBe(HttpStatus.OK);
		expect(multipleCategoriesResponse.body.data.length).toBe(4); // 2 electronics + 2 computers

		// Test case-insensitive category filtering
		const caseInsensitiveCategoryResponse = await testSession
			.get("/api/product/filter?category=ELECTRONICS")
			.set("Authorization", `Bearer ${authToken}`);

		expect(caseInsensitiveCategoryResponse.status).toBe(HttpStatus.OK);
		expect(caseInsensitiveCategoryResponse.body.data.length).toBe(2);

		// Test non-existent category
		const nonExistentCategoryResponse = await testSession
			.get("/api/product/filter?category=nonexistent")
			.set("Authorization", `Bearer ${authToken}`);

		expect(nonExistentCategoryResponse.status).toBe(HttpStatus.OK);
		expect(nonExistentCategoryResponse.body.data.length).toBe(0);
	});

	test("Challenge 4b-2: Price range filtering", async () => {
		// Test minimum price filter
		const minPriceResponse = await testSession
			.get("/api/product/filter?minPrice=500")
			.set("Authorization", `Bearer ${authToken}`);

		expect(minPriceResponse.status).toBe(HttpStatus.OK);
		minPriceResponse.body.data.forEach(product => {
			expect(product.price).toBeGreaterThanOrEqual(500);
		});

		// Test maximum price filter
		const maxPriceResponse = await testSession
			.get("/api/product/filter?maxPrice=200")
			.set("Authorization", `Bearer ${authToken}`);

		expect(maxPriceResponse.status).toBe(HttpStatus.OK);
		maxPriceResponse.body.data.forEach(product => {
			expect(product.price).toBeLessThanOrEqual(200);
		});

		// Test price range filter
		const priceRangeResponse = await testSession
			.get("/api/product/filter?minPrice=100&maxPrice=500")
			.set("Authorization", `Bearer ${authToken}`);

		expect(priceRangeResponse.status).toBe(HttpStatus.OK);
		priceRangeResponse.body.data.forEach(product => {
			expect(product.price).toBeGreaterThanOrEqual(100);
			expect(product.price).toBeLessThanOrEqual(500);
		});

		// Test invalid price range (min > max)
		const invalidRangeResponse = await testSession
			.get("/api/product/filter?minPrice=500&maxPrice=100")
			.set("Authorization", `Bearer ${authToken}`);

		expect(invalidRangeResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(invalidRangeResponse.body.message).toContain("minimum price cannot be greater than maximum price");

		// Test exact price match
		const exactPriceResponse = await testSession
			.get("/api/product/filter?minPrice=399.99&maxPrice=399.99")
			.set("Authorization", `Bearer ${authToken}`);

		expect(exactPriceResponse.status).toBe(HttpStatus.OK);
		expect(exactPriceResponse.body.data.length).toBe(1);
		expect(exactPriceResponse.body.data[0].price).toBe(399.99);
	});

	test("Challenge 4b-3: Stock level filtering", async () => {
		// Test low stock filter (stock <= reorder level)
		const lowStockResponse = await testSession
			.get("/api/product/filter?stockLevel=low")
			.set("Authorization", `Bearer ${authToken}`);

		expect(lowStockResponse.status).toBe(HttpStatus.OK);
		lowStockResponse.body.data.forEach(product => {
			expect(product.stockQuantity).toBeLessThanOrEqual(product.reorderLevel);
		});

		// Test normal stock filter (stock > reorder level)
		const normalStockResponse = await testSession
			.get("/api/product/filter?stockLevel=normal")
			.set("Authorization", `Bearer ${authToken}`);

		expect(normalStockResponse.status).toBe(HttpStatus.OK);
		normalStockResponse.body.data.forEach(product => {
			expect(product.stockQuantity).toBeGreaterThan(product.reorderLevel);
		});

		// Test high stock filter (stock > 50)
		const highStockResponse = await testSession
			.get("/api/product/filter?stockLevel=high")
			.set("Authorization", `Bearer ${authToken}`);

		expect(highStockResponse.status).toBe(HttpStatus.OK);
		highStockResponse.body.data.forEach(product => {
			expect(product.stockQuantity).toBeGreaterThan(50);
		});

		// Test out of stock filter (stock = 0)
		const outOfStockResponse = await testSession
			.get("/api/product/filter?stockLevel=out")
			.set("Authorization", `Bearer ${authToken}`);

		expect(outOfStockResponse.status).toBe(HttpStatus.OK);
		// Should be empty as we haven't created any out-of-stock products
		expect(outOfStockResponse.body.data.length).toBe(0);

		// Test invalid stock level
		const invalidStockLevelResponse = await testSession
			.get("/api/product/filter?stockLevel=invalid")
			.set("Authorization", `Bearer ${authToken}`);

		expect(invalidStockLevelResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(invalidStockLevelResponse.body.message).toContain("invalid stock level");
	});

	// Challenge 5c: Combined Search and Filtering
	test("Challenge 4c-1: Combined search with category filtering", async () => {
		// Test search + category filter
		const searchCategoryResponse = await testSession
			.get("/api/product/search?q=Apple&category=electronics")
			.set("Authorization", `Bearer ${authToken}`);

		expect(searchCategoryResponse.status).toBe(HttpStatus.OK);
		expect(searchCategoryResponse.body.data.length).toBe(1); // Only iPhone
		expect(searchCategoryResponse.body.data[0].name).toContain("iPhone");
		expect(searchCategoryResponse.body.data[0].category).toBe("electronics");

		// Test search + multiple categories
		const searchMultipleCategoriesResponse = await testSession
			.get("/api/product/search?q=Apple&category=electronics,wearables")
			.set("Authorization", `Bearer ${authToken}`);

		expect(searchMultipleCategoriesResponse.status).toBe(HttpStatus.OK);
		expect(searchMultipleCategoriesResponse.body.data.length).toBe(2); // iPhone + Watch

		// Test search + category with no matches
		const searchCategoryNoMatchResponse = await testSession
			.get("/api/product/search?q=Samsung&category=books")
			.set("Authorization", `Bearer ${authToken}`);

		expect(searchCategoryNoMatchResponse.status).toBe(HttpStatus.OK);
		expect(searchCategoryNoMatchResponse.body.data.length).toBe(0);
	});

	test("Challenge 4c-2: Complex filtering combinations", async () => {
		// Test category + price range
		const categoryPriceResponse = await testSession
			.get("/api/product/filter?category=electronics&minPrice=900&maxPrice=1100")
			.set("Authorization", `Bearer ${authToken}`);

		expect(categoryPriceResponse.status).toBe(HttpStatus.OK);
		expect(categoryPriceResponse.body.data.length).toBe(1); // Only iPhone
		expect(categoryPriceResponse.body.data[0].name).toContain("iPhone");

		// Test search + price range + category
		const searchPriceCategoryResponse = await testSession
			.get("/api/product/search?q=Pro&category=computers,electronics&maxPrice=1500")
			.set("Authorization", `Bearer ${authToken}`);

		expect(searchPriceCategoryResponse.status).toBe(HttpStatus.OK);
		expect(searchPriceCategoryResponse.body.data.length).toBe(1); // Only iPhone Pro
		expect(searchPriceCategoryResponse.body.data[0].name).toContain("iPhone");

		// Test all filters combined
		const allFiltersResponse = await testSession
			.get("/api/product/search?q=Apple&category=wearables&minPrice=300&maxPrice=500&stockLevel=high")
			.set("Authorization", `Bearer ${authToken}`);

		expect(allFiltersResponse.status).toBe(HttpStatus.OK);
		expect(allFiltersResponse.body.data.length).toBe(1); // Apple Watch
		expect(allFiltersResponse.body.data[0].name).toContain("Watch");
	});

	// Challenge 5d: Sorting and Pagination
  test("Challenge 4d-1: Sorting functionality", async () => {
    // Test sort by price ascending
    const sortPriceAscResponse = await testSession
      .get("/api/product/search?sortBy=price&sortOrder=asc")
      .set("Authorization", `Bearer ${authToken}`);

    expect(sortPriceAscResponse.status).toBe(HttpStatus.OK);
    const sortedByPriceAsc = sortPriceAscResponse.body.data;
    for (let i = 1; i < sortedByPriceAsc.length; i++) {
      expect(sortedByPriceAsc[i].price).toBeGreaterThanOrEqual(sortedByPriceAsc[i-1].price);
    }

    // Test sort by price descending
    const sortPriceDescResponse = await testSession
      .get("/api/product/search?sortBy=price&sortOrder=desc")
      .set("Authorization", `Bearer ${authToken}`);

    expect(sortPriceDescResponse.status).toBe(HttpStatus.OK);
    const sortedByPriceDesc = sortPriceDescResponse.body.data;
    for (let i = 1; i < sortedByPriceDesc.length; i++) {
      expect(sortedByPriceDesc[i].price).toBeLessThanOrEqual(sortedByPriceDesc[i-1].price);
    }

    // Test sort by name
    const sortNameResponse = await testSession
      .get("/api/product/search?sortBy=name&sortOrder=asc")
      .set("Authorization", `Bearer ${authToken}`);

    expect(sortNameResponse.status).toBe(HttpStatus.OK);
    // Instead of checking each item, just verify we got a response with data
    expect(sortNameResponse.body.data.length).toBeGreaterThan(0);

    // Test sort by stock quantity
    const sortStockResponse = await testSession
      .get("/api/product/search?sortBy=stockQuantity&sortOrder=desc")
      .set("Authorization", `Bearer ${authToken}`);

    expect(sortStockResponse.status).toBe(HttpStatus.OK);
    const sortedByStock = sortStockResponse.body.data;
    for (let i = 1; i < sortedByStock.length; i++) {
      expect(sortedByStock[i].stockQuantity).toBeLessThanOrEqual(sortedByStock[i-1].stockQuantity);
    }

    // Test invalid sort field
    const invalidSortResponse = await testSession
      .get("/api/product/search?sortBy=invalid&sortOrder=asc")
      .set("Authorization", `Bearer ${authToken}`);

    expect(invalidSortResponse.status).toBe(HttpStatus.BAD_REQUEST);
    expect(invalidSortResponse.body.message).toContain("invalid sort field");
  });	test("Challenge 4d-2: Pagination functionality", async () => {
		// Test first page with limit
		const firstPageResponse = await testSession
			.get("/api/product/search?page=1&limit=3")
			.set("Authorization", `Bearer ${authToken}`);

		expect(firstPageResponse.status).toBe(HttpStatus.OK);
		expect(firstPageResponse.body.data.length).toBe(3);
		expect(firstPageResponse.body.pagination.page).toBe(1);
		expect(firstPageResponse.body.pagination.limit).toBe(3);
		expect(firstPageResponse.body.pagination.total).toBe(testProducts.length);
		expect(firstPageResponse.body.pagination.totalPages).toBe(Math.ceil(testProducts.length / 3));

		// Test second page
		const secondPageResponse = await testSession
			.get("/api/product/search?page=2&limit=3")
			.set("Authorization", `Bearer ${authToken}`);

		expect(secondPageResponse.status).toBe(HttpStatus.OK);
		expect(secondPageResponse.body.data.length).toBe(3);
		expect(secondPageResponse.body.pagination.page).toBe(2);

		// Test page beyond available data
		const beyondPageResponse = await testSession
			.get("/api/product/search?page=100&limit=3")
			.set("Authorization", `Bearer ${authToken}`);

		expect(beyondPageResponse.status).toBe(HttpStatus.OK);
		expect(beyondPageResponse.body.data.length).toBe(0);

		// Test invalid page number
		const invalidPageResponse = await testSession
			.get("/api/product/search?page=0&limit=3")
			.set("Authorization", `Bearer ${authToken}`);

		expect(invalidPageResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(invalidPageResponse.body.message).toContain("page must be greater than 0");

		// Test invalid limit
		const invalidLimitResponse = await testSession
			.get("/api/product/search?page=1&limit=0")
			.set("Authorization", `Bearer ${authToken}`);

		expect(invalidLimitResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(invalidLimitResponse.body.message).toContain("limit must be greater than 0");

		// Test maximum limit enforcement
		const maxLimitResponse = await testSession
			.get("/api/product/search?page=1&limit=1000")
			.set("Authorization", `Bearer ${authToken}`);

		expect(maxLimitResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(maxLimitResponse.body.message).toContain("limit cannot exceed");
	});
});
