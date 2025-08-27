import db from "../db/db-config.js";

const ProductRepository = {

  // Get product by ID
  async getById(id) {
    return await db.get("SELECT * FROM products WHERE id = ?", [id]);
  },

  // Create product
  async createProduct(product) {
    const { name, sku, price, category, stockQuantity = 0, reorderLevel = 0, description = "", isActive = true } = product;
    const sql = `
      INSERT INTO products (name, sku, price, category, stockQuantity, reorderLevel, description, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await db.run(sql, [name, sku, price, category, stockQuantity, reorderLevel, description, isActive]);
    return { id: result.lastID, ...product };
  },

  // Update product fields
  async updateProduct(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setSQL = fields.map(f => `${f} = ?`).join(", ");
    const sql = `UPDATE products SET ${setSQL} WHERE id = ?`;
    await db.run(sql, [...values, id]);
    return this.getById(id);
  },

  // Update stock safely with validation
  async updateStock(id, quantity, operation) {
    return db.serialize(async () => {
      const product = await this.getById(id);
      if (!product) throw new Error("Product not found");

      // Validate integer quantity
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Quantity must be an integer greater than 0");
      }

      let newStock;
      if (operation === "add") {
        newStock = product.stockQuantity + quantity;
      } else if (operation === "subtract") {
        if (product.stockQuantity < quantity) {
          throw new Error("Insufficient stock");
        }
        newStock = product.stockQuantity - quantity;
      } else {
        throw new Error("Invalid stock operation. Allowed: add, subtract");
      }

      await db.run("UPDATE products SET stockQuantity = ? WHERE id = ?", [newStock, id]);
      return this.getById(id);
    });
  },

  // Get products below reorder level (active only)
  async getReorderList() {
    return await db.all(`
      SELECT *
      FROM products
      WHERE isActive = 1 AND stockQuantity <= reorderLevel
      ORDER BY (stockQuantity * 1.0 / reorderLevel) ASC
    `);
  },

  // Check SKU uniqueness (case-insensitive)
  async isSkuUnique(sku, excludeId = null) {
    const sql = excludeId
      ? `SELECT * FROM products WHERE LOWER(sku) = LOWER(?) AND id != ?`
      : `SELECT * FROM products WHERE LOWER(sku) = LOWER(?)`;
    const params = excludeId ? [sku, excludeId] : [sku];
    const result = await db.get(sql, params);
    return !result;
  }

};

export default ProductRepository;
