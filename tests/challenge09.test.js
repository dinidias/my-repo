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

describe("Challenge 09: Advanced Frontend Interactions", () => {
	
	let authToken = null;
	let testUserId = null;
	let frontendTestProducts = [];

	beforeEach(async () => {
		// Create a test user and get auth token
		const userData = {
			firstName: "Frontend",
			lastName: "Tester",
			email: "frontend@example.com",
			password: "FrontendPass123!"
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

		// Create test products for frontend interactions
		const products = [
			{
				name: "Draggable Product A",
				sku: "DRAG-A-001",
				price: 99.99,
				stockQuantity: 50,
				reorderLevel: 10,
				category: "electronics",
				position: { x: 100, y: 100 },
				metadata: { draggable: true, resizable: false }
			},
			{
				name: "Draggable Product B",
				sku: "DRAG-B-001",
				price: 149.99,
				stockQuantity: 30,
				reorderLevel: 8,
				category: "books",
				position: { x: 200, y: 150 },
				metadata: { draggable: true, resizable: true }
			},
			{
				name: "Interactive Product C",
				sku: "INTERACT-C-001",
				price: 79.99,
				stockQuantity: 75,
				reorderLevel: 15,
				category: "clothing",
				position: { x: 300, y: 200 },
				metadata: { interactive: true, contextMenu: true }
			}
		];

		frontendTestProducts = [];
		for (const product of products) {
			const response = await testSession
				.post("/api/product")
				.set("Authorization", `Bearer ${authToken}`)
				.send(product);

			expect(response.status).toBe(HttpStatus.CREATED);
			frontendTestProducts.push(response.body.data);
		}
	});

	// Challenge 9a: Drag and Drop Functionality
	test("Challenge 9a-1: Product drag and drop interface", async () => {
		// Test drag and drop API endpoints
		const dragStartResponse = await testSession
			.post("/api/frontend/drag-drop/start")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				productId: frontendTestProducts[0].id,
				sourceContainer: "inventory-grid",
				dragData: {
					startPosition: { x: 100, y: 100 },
					elementSize: { width: 200, height: 150 },
					dragType: "move"
				}
			});

		expect(dragStartResponse.status).toBe(HttpStatus.OK);
		expect(dragStartResponse.body.data.dragSessionId).toBeDefined();
		expect(dragStartResponse.body.data.allowedDropZones).toBeDefined();
		expect(Array.isArray(dragStartResponse.body.data.allowedDropZones)).toBeTruthy();

		const dragSessionId = dragStartResponse.body.data.dragSessionId;

		// Test drag move tracking
		const dragMoveResponse = await testSession
			.put(`/api/frontend/drag-drop/${dragSessionId}/move`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				currentPosition: { x: 250, y: 180 },
				hoveredDropZone: "category-electronics",
				dragProgress: 0.6
			});

		expect(dragMoveResponse.status).toBe(HttpStatus.OK);
		expect(dragMoveResponse.body.data.validDrop).toBeDefined();
		expect(dragMoveResponse.body.data.dropPreview).toBeDefined();

		// Test successful drop
		const dropResponse = await testSession
			.post(`/api/frontend/drag-drop/${dragSessionId}/drop`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				dropPosition: { x: 300, y: 220 },
				targetContainer: "category-electronics",
				dropAction: "move",
				metadata: {
					newCategory: "electronics",
					previousCategory: "electronics"
				}
			});

		expect(dropResponse.status).toBe(HttpStatus.OK);
		expect(dropResponse.body.data.success).toBeTruthy();
		expect(dropResponse.body.data.updatedProduct).toBeDefined();
		expect(dropResponse.body.data.updatedProduct.position.x).toBe(300);
		expect(dropResponse.body.data.updatedProduct.position.y).toBe(220);

		// Test drag and drop validation - invalid drop
		const invalidDragResponse = await testSession
			.post("/api/frontend/drag-drop/start")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				productId: frontendTestProducts[1].id,
				sourceContainer: "inventory-grid",
				dragData: { dragType: "copy" }
			});

		const invalidDropResponse = await testSession
			.post(`/api/frontend/drag-drop/${invalidDragResponse.body.data.dragSessionId}/drop`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				targetContainer: "restricted-zone",
				dropAction: "move"
			});

		expect(invalidDropResponse.status).toBe(HttpStatus.BAD_REQUEST);
		expect(invalidDropResponse.body.message).toContain("invalid drop zone");

		// Test bulk drag and drop
		const bulkDragResponse = await testSession
			.post("/api/frontend/drag-drop/bulk")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				productIds: frontendTestProducts.map(p => p.id),
				sourceContainer: "inventory-grid",
				targetContainer: "category-books",
				dragAction: "move",
				preserveRelativePositions: true
			});

		expect(bulkDragResponse.status).toBe(HttpStatus.OK);
		expect(bulkDragResponse.body.data.successCount).toBeDefined();
		expect(bulkDragResponse.body.data.failedItems).toBeDefined();
		expect(Array.isArray(bulkDragResponse.body.data.updatedProducts)).toBeTruthy();
	});

	test("Challenge 9a-2: Advanced drop zone interactions", async () => {
		// Test smart drop zones with automatic categorization
		const smartDropResponse = await testSession
			.post("/api/frontend/drop-zones/smart-drop")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				productId: frontendTestProducts[0].id,
				dropZone: "smart-categorizer",
				productData: {
					name: "Gaming Laptop",
					description: "High-performance gaming laptop with RGB",
					price: 1299.99
				},
				aiCategorization: true
			});

		expect(smartDropResponse.status).toBe(HttpStatus.OK);
		expect(smartDropResponse.body.data.suggestedCategory).toBeDefined();
		expect(smartDropResponse.body.data.confidence).toBeDefined();
		expect(smartDropResponse.body.data.confidence).toBeGreaterThan(0);
		expect(smartDropResponse.body.data.confidence).toBeLessThanOrEqual(1);
		expect(smartDropResponse.body.data.alternativeCategories).toBeDefined();

		// Test conditional drop zones
		const conditionalDropResponse = await testSession
			.post("/api/frontend/drop-zones/conditional")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				productId: frontendTestProducts[1].id,
				dropZone: "high-value-zone",
				conditions: {
					minPrice: 100,
					maxStock: 50,
					requiredCategories: ["electronics", "books"]
				}
			});

		expect(conditionalDropResponse.status).toBe(HttpStatus.OK);
		expect(conditionalDropResponse.body.data.allowed).toBeDefined();
		expect(conditionalDropResponse.body.data.reason).toBeDefined();

		if (!conditionalDropResponse.body.data.allowed) {
			expect(conditionalDropResponse.body.data.failedConditions).toBeDefined();
			expect(Array.isArray(conditionalDropResponse.body.data.failedConditions)).toBeTruthy();
		}

		// Test drop zone capacity management
		const capacityResponse = await testSession
			.get("/api/frontend/drop-zones/capacity")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				zoneId: "limited-capacity-zone",
				includeCurrentItems: true
			});

		expect(capacityResponse.status).toBe(HttpStatus.OK);
		expect(capacityResponse.body.data.maxCapacity).toBeDefined();
		expect(capacityResponse.body.data.currentCount).toBeDefined();
		expect(capacityResponse.body.data.availableSpace).toBeDefined();
		expect(capacityResponse.body.data.currentItems).toBeDefined();
	});

	// Challenge 9b: Advanced UI State Management
	test("Challenge 9b-1: Complex state synchronization", async () => {
		// Test multi-view state synchronization
		const stateInitResponse = await testSession
			.post("/api/frontend/state/initialize")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				viewId: "inventory-dashboard",
				initialState: {
					selectedProducts: frontendTestProducts.slice(0, 2).map(p => p.id),
					filterState: {
						category: "electronics",
						priceRange: { min: 50, max: 500 },
						sortBy: "name"
					},
					uiState: {
						layout: "grid",
						zoom: 1.0,
						selectedTool: "select"
					}
				}
			});

		expect(stateInitResponse.status).toBe(HttpStatus.OK);
		expect(stateInitResponse.body.data.stateId).toBeDefined();
		expect(stateInitResponse.body.data.syncToken).toBeDefined();

		const stateId = stateInitResponse.body.data.stateId;

		// Test state updates with conflict resolution
		const stateUpdateResponse = await testSession
			.put(`/api/frontend/state/${stateId}`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				updates: {
					selectedProducts: [frontendTestProducts[2].id],
					filterState: {
						category: "books"
					}
				},
				conflictResolution: "merge",
				clientTimestamp: Date.now()
			});

		expect(stateUpdateResponse.status).toBe(HttpStatus.OK);
		expect(stateUpdateResponse.body.data.updatedState).toBeDefined();
		expect(stateUpdateResponse.body.data.conflicts).toBeDefined();

		// Test optimistic updates
		const optimisticUpdateResponse = await testSession
			.post(`/api/frontend/state/${stateId}/optimistic`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				operation: "add_selection",
				data: { productId: frontendTestProducts[0].id },
				clientTransactionId: "tx-001",
				rollbackData: {
					operation: "remove_selection",
					data: { productId: frontendTestProducts[0].id }
				}
			});

		expect(optimisticUpdateResponse.status).toBe(HttpStatus.OK);
		expect(optimisticUpdateResponse.body.data.transactionId).toBeDefined();
		expect(optimisticUpdateResponse.body.data.applied).toBeTruthy();

		// Test state rollback
		const rollbackResponse = await testSession
			.post(`/api/frontend/state/${stateId}/rollback`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				transactionId: optimisticUpdateResponse.body.data.transactionId,
				reason: "user_cancelled"
			});

		expect(rollbackResponse.status).toBe(HttpStatus.OK);
		expect(rollbackResponse.body.data.rolledBack).toBeTruthy();

		// Test state history and undo/redo
		const historyResponse = await testSession
			.get(`/api/frontend/state/${stateId}/history`)
			.set("Authorization", `Bearer ${authToken}`)
			.query({ limit: 10 });

		expect(historyResponse.status).toBe(HttpStatus.OK);
		expect(historyResponse.body.data.history).toBeDefined();
		expect(Array.isArray(historyResponse.body.data.history)).toBeTruthy();
		expect(historyResponse.body.data.currentPosition).toBeDefined();
		expect(historyResponse.body.data.canUndo).toBeDefined();
		expect(historyResponse.body.data.canRedo).toBeDefined();
	});

	test("Challenge 9b-2: Real-time collaborative features", async () => {
		// Test collaborative cursors and presence
		const presenceResponse = await testSession
			.post("/api/frontend/collaboration/presence")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				sessionId: "collab-session-001",
				presence: {
					cursor: { x: 350, y: 275 },
					selection: [frontendTestProducts[0].id],
					tool: "select",
					viewport: {
						x: 0, y: 0, width: 1920, height: 1080, zoom: 1.0
					}
				},
				metadata: {
					userName: "Frontend Tester",
					color: "#3498db"
				}
			});

		expect(presenceResponse.status).toBe(HttpStatus.OK);
		expect(presenceResponse.body.data.presenceId).toBeDefined();
		expect(presenceResponse.body.data.otherUsers).toBeDefined();

		// Test collaborative editing locks
		const lockResponse = await testSession
			.post("/api/frontend/collaboration/lock")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				resourceType: "product",
				resourceId: frontendTestProducts[0].id,
				lockType: "edit",
				timeoutSeconds: 300
			});

		expect(lockResponse.status).toBe(HttpStatus.OK);
		expect(lockResponse.body.data.lockId).toBeDefined();
		expect(lockResponse.body.data.expiresAt).toBeDefined();

		// Test conflict resolution in collaborative editing
		const conflictResponse = await testSession
			.post("/api/frontend/collaboration/resolve-conflict")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				conflictId: "conflict-001",
				resolution: "accept_local",
				localChanges: {
					name: "Updated Product Name",
					price: 199.99
				},
				remoteChanges: {
					name: "Different Product Name",
					price: 189.99
				}
			});

		expect(conflictResponse.status).toBe(HttpStatus.OK);
		expect(conflictResponse.body.data.resolved).toBeTruthy();
		expect(conflictResponse.body.data.finalState).toBeDefined();

		// Test collaborative cursors update
		const cursorUpdateResponse = await testSession
			.put(`/api/frontend/collaboration/cursor`)
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				sessionId: "collab-session-001",
				cursor: { x: 400, y: 300 },
				action: "hovering",
				target: {
					type: "product",
					id: frontendTestProducts[1].id
				}
			});

		expect(cursorUpdateResponse.status).toBe(HttpStatus.OK);
		expect(cursorUpdateResponse.body.data.updated).toBeTruthy();
	});

	// Challenge 9c: Advanced Interactions
	test("Challenge 9c-1: Context menu and shortcuts", async () => {
		// Test dynamic context menu generation
		const contextMenuResponse = await testSession
			.post("/api/frontend/context-menu")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				targetType: "product",
				targetId: frontendTestProducts[0].id,
				position: { x: 250, y: 180 },
				modifierKeys: ["ctrl"],
				selectionState: {
					selectedCount: 1,
					multiSelect: false
				}
			});

		expect(contextMenuResponse.status).toBe(HttpStatus.OK);
		expect(contextMenuResponse.body.data.menuItems).toBeDefined();
		expect(Array.isArray(contextMenuResponse.body.data.menuItems)).toBeTruthy();

		contextMenuResponse.body.data.menuItems.forEach(item => {
			expect(item.id).toBeDefined();
			expect(item.label).toBeDefined();
			expect(item.action).toBeDefined();
			expect(item.enabled).toBeDefined();
			
			if (item.shortcut) {
				expect(item.shortcut.key).toBeDefined();
				expect(item.shortcut.modifiers).toBeDefined();
			}
		});

		// Test context menu action execution
		const menuActionResponse = await testSession
			.post("/api/frontend/context-menu/execute")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				actionId: "duplicate_product",
				targetId: frontendTestProducts[0].id,
				parameters: {
					copyName: true,
					copyPrice: true,
					resetStock: true
				}
			});

		expect(menuActionResponse.status).toBe(HttpStatus.OK);
		expect(menuActionResponse.body.data.executed).toBeTruthy();
		
		if (menuActionResponse.body.data.result) {
			expect(menuActionResponse.body.data.result.newProductId).toBeDefined();
		}

		// Test keyboard shortcuts registration
		const shortcutResponse = await testSession
			.post("/api/frontend/shortcuts/register")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				shortcuts: [
					{
						id: "quick_edit",
						combination: "ctrl+e",
						action: "edit_selected_product",
						scope: "global",
						preventDefault: true
					},
					{
						id: "bulk_update",
						combination: "ctrl+shift+u",
						action: "bulk_update_dialog",
						scope: "product_grid",
						preventDefault: true
					},
					{
						id: "quick_filter",
						combination: "ctrl+f",
						action: "focus_search",
						scope: "global",
						preventDefault: false
					}
				]
			});

		expect(shortcutResponse.status).toBe(HttpStatus.OK);
		expect(shortcutResponse.body.data.registered).toBeDefined();
		expect(shortcutResponse.body.data.conflicts).toBeDefined();

		// Test shortcut execution
		const shortcutExecuteResponse = await testSession
			.post("/api/frontend/shortcuts/execute")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				shortcutId: "quick_edit",
				context: {
					selectedProducts: [frontendTestProducts[0].id],
					currentView: "grid"
				}
			});

		expect(shortcutExecuteResponse.status).toBe(HttpStatus.OK);
		expect(shortcutExecuteResponse.body.data.executed).toBeTruthy();
	});

	test("Challenge 9c-2: Advanced selection and multi-select", async () => {
		// Test complex selection operations
		const selectionResponse = await testSession
			.post("/api/frontend/selection")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				operation: "rectangle_select",
				area: {
					startX: 100, startY: 100,
					endX: 400, endY: 300
				},
				modifiers: ["ctrl"],
				filters: {
					includeHidden: false,
					categoryFilter: ["electronics", "books"]
				}
			});

		expect(selectionResponse.status).toBe(HttpStatus.OK);
		expect(selectionResponse.body.data.selectedItems).toBeDefined();
		expect(Array.isArray(selectionResponse.body.data.selectedItems)).toBeTruthy();
		expect(selectionResponse.body.data.selectionBounds).toBeDefined();

		// Test selection persistence and restoration
		const saveSelectionResponse = await testSession
			.post("/api/frontend/selection/save")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				selectionName: "my_custom_selection",
				selectedItems: frontendTestProducts.slice(0, 2).map(p => p.id),
				metadata: {
					description: "Products for bulk update",
					tags: ["electronics", "high-priority"]
				}
			});

		expect(saveSelectionResponse.status).toBe(HttpStatus.OK);
		expect(saveSelectionResponse.body.data.selectionId).toBeDefined();

		const restoreSelectionResponse = await testSession
			.get(`/api/frontend/selection/${saveSelectionResponse.body.data.selectionId}`)
			.set("Authorization", `Bearer ${authToken}`);

		expect(restoreSelectionResponse.status).toBe(HttpStatus.OK);
		expect(restoreSelectionResponse.body.data.selectedItems).toBeDefined();
		expect(restoreSelectionResponse.body.data.selectedItems.length).toBe(2);

		// Test smart selection algorithms
		const smartSelectionResponse = await testSession
			.post("/api/frontend/selection/smart")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				algorithm: "similar_products",
				seedProduct: frontendTestProducts[0].id,
				similarity: {
					price: { weight: 0.3, tolerance: 0.2 },
					category: { weight: 0.5, exact: true },
					stock: { weight: 0.2, tolerance: 0.3 }
				},
				maxResults: 10
			});

		expect(smartSelectionResponse.status).toBe(HttpStatus.OK);
		expect(smartSelectionResponse.body.data.selectedItems).toBeDefined();
		expect(smartSelectionResponse.body.data.similarityScores).toBeDefined();

		// Test selection operations (union, intersection, difference)
		const selectionOpResponse = await testSession
			.post("/api/frontend/selection/operation")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				operation: "union",
				sets: [
					{ type: "saved", id: saveSelectionResponse.body.data.selectionId },
					{ type: "smart", items: smartSelectionResponse.body.data.selectedItems }
				],
				name: "combined_selection"
			});

		expect(selectionOpResponse.status).toBe(HttpStatus.OK);
		expect(selectionOpResponse.body.data.resultSet).toBeDefined();
		expect(selectionOpResponse.body.data.operationDetails).toBeDefined();
	});

	// Challenge 9d: Performance and UX Optimization
	test("Challenge 9d-1: Virtual scrolling and lazy loading", async () => {
		// Test virtual scrolling configuration
		const virtualScrollResponse = await testSession
			.get("/api/frontend/virtual-scroll")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				containerHeight: 600,
				itemHeight: 80,
				bufferSize: 5,
				totalItems: 1000,
				startIndex: 50
			});

		expect(virtualScrollResponse.status).toBe(HttpStatus.OK);
		expect(virtualScrollResponse.body.data.visibleRange).toBeDefined();
		expect(virtualScrollResponse.body.data.visibleRange.start).toBeDefined();
		expect(virtualScrollResponse.body.data.visibleRange.end).toBeDefined();
		expect(virtualScrollResponse.body.data.renderItems).toBeDefined();
		expect(Array.isArray(virtualScrollResponse.body.data.renderItems)).toBeTruthy();

		// Test dynamic item height handling
		const dynamicHeightResponse = await testSession
			.post("/api/frontend/virtual-scroll/dynamic-height")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				scrollPosition: 1200,
				measuredHeights: {
					"0": 85, "1": 90, "2": 78, "3": 95, "4": 82
				},
				averageHeight: 86,
				viewport: { height: 600, width: 800 }
			});

		expect(dynamicHeightResponse.status).toBe(HttpStatus.OK);
		expect(dynamicHeightResponse.body.data.updatedRange).toBeDefined();
		expect(dynamicHeightResponse.body.data.scrollOffset).toBeDefined();

		// Test lazy loading triggers
		const lazyLoadResponse = await testSession
			.get("/api/frontend/lazy-load/trigger")
			.set("Authorization", `Bearer ${authToken}`)
			.query({
				currentIndex: 45,
				direction: "down",
				threshold: 5,
				loadSize: 20
			});

		expect(lazyLoadResponse.status).toBe(HttpStatus.OK);
		expect(lazyLoadResponse.body.data.shouldLoad).toBeDefined();
		expect(lazyLoadResponse.body.data.loadRange).toBeDefined();
		
		if (lazyLoadResponse.body.data.shouldLoad) {
			expect(lazyLoadResponse.body.data.loadRange.start).toBeDefined();
			expect(lazyLoadResponse.body.data.loadRange.end).toBeDefined();
		}

		// Test preloading strategies
		const preloadResponse = await testSession
			.post("/api/frontend/preload")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				strategy: "predictive",
				userBehavior: {
					scrollSpeed: 250, // pixels per second
					pausePoints: [100, 300, 500],
					interactionFrequency: 0.7
				},
				contentHints: {
					heavyItems: [25, 55, 89],
					priorityItems: [10, 20, 30]
				}
			});

		expect(preloadResponse.status).toBe(HttpStatus.OK);
		expect(preloadResponse.body.data.preloadQueue).toBeDefined();
		expect(Array.isArray(preloadResponse.body.data.preloadQueue)).toBeTruthy();
	});

	test("Challenge 9d-2: Animation and transition optimization", async () => {
		// Test animation performance monitoring
		const animationPerfResponse = await testSession
			.post("/api/frontend/animation/performance")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				animationId: "product-grid-transition",
				frameTimes: [16.7, 16.8, 33.2, 16.9, 17.1, 50.3, 16.6],
				duration: 500,
				targetFps: 60,
				dropped_frames: 2
			});

		expect(animationPerfResponse.status).toBe(HttpStatus.OK);
		expect(animationPerfResponse.body.data.averageFps).toBeDefined();
		expect(animationPerfResponse.body.data.performanceScore).toBeDefined();
		expect(animationPerfResponse.body.data.recommendations).toBeDefined();

		// Test adaptive animation quality
		const adaptiveAnimResponse = await testSession
			.post("/api/frontend/animation/adaptive")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				deviceCapability: {
					cpu: "medium",
					gpu: "low",
					memory: "high",
					battery: "medium"
				},
				currentPerformance: {
					fps: 45,
					memoryUsage: 0.6,
					cpuUsage: 0.8
				},
				animationType: "complex_transition"
			});

		expect(adaptiveAnimResponse.status).toBe(HttpStatus.OK);
		expect(adaptiveAnimResponse.body.data.recommendedSettings).toBeDefined();
		expect(adaptiveAnimResponse.body.data.recommendedSettings.quality).toBeDefined();
		expect(["low", "medium", "high"]).toContain(adaptiveAnimResponse.body.data.recommendedSettings.quality);

		// Test transition choreography
		const choreographyResponse = await testSession
			.post("/api/frontend/animation/choreography")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				transitions: [
					{
						id: "fade-out-old",
						element: "product-grid",
						type: "opacity",
						duration: 200,
						easing: "ease-out"
					},
					{
						id: "slide-in-new",
						element: "product-grid",
						type: "transform",
						duration: 300,
						delay: 150,
						easing: "ease-in-out"
					},
					{
						id: "highlight-changed",
						element: "updated-items",
						type: "background-color",
						duration: 150,
						delay: 400,
						easing: "ease-in"
					}
				],
				sequencing: "overlapped",
				totalDuration: 600
			});

		expect(choreographyResponse.status).toBe(HttpStatus.OK);
		expect(choreographyResponse.body.data.optimizedSequence).toBeDefined();
		expect(choreographyResponse.body.data.timeline).toBeDefined();
		expect(choreographyResponse.body.data.conflictResolution).toBeDefined();

		// Test gesture recognition and response
		const gestureResponse = await testSession
			.post("/api/frontend/gestures/recognize")
			.set("Authorization", `Bearer ${authToken}`)
			.send({
				inputType: "touch",
				gestureData: {
					points: [
						{ x: 100, y: 100, timestamp: 0 },
						{ x: 120, y: 95, timestamp: 50 },
						{ x: 180, y: 90, timestamp: 150 },
						{ x: 280, y: 85, timestamp: 300 }
					],
					pressure: [0.5, 0.6, 0.7, 0.6],
					velocity: [0, 0.4, 0.8, 0.9]
				},
				context: {
					element: "product-card",
					targetId: frontendTestProducts[0].id
				}
			});

		expect(gestureResponse.status).toBe(HttpStatus.OK);
		expect(gestureResponse.body.data.recognizedGesture).toBeDefined();
		expect(gestureResponse.body.data.confidence).toBeDefined();
		expect(gestureResponse.body.data.suggestedAction).toBeDefined();
		
		if (gestureResponse.body.data.recognizedGesture !== "unknown") {
			expect(gestureResponse.body.data.parameters).toBeDefined();
		}
	});
});
