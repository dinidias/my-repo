import knex_db from "../../db/db-config.js";
import Product from "../models/product.js";

const createProduct = async (product) => {
  const { id, name, description, sku, price, stockQuantity, reorderLevel, category, supplierId, userId } = product;
  try {
    const result = await knex_db.raw(
      `INSERT INTO product (id, name, sku, price, stock_quantity, category, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
       RETURNING *`,
      [id, name, sku, price, stockQuantity, category, userId] // Missing description, reorderLevel, isActive, supplierId
    );

    if (result.length > 0) {
      const createdProduct = result[0];
      return new Product(
        createdProduct.id,
        createdProduct.name,
        createdProduct.description,
        createdProduct.sku,
        createdProduct.price,
        createdProduct.stock_quantity,
        createdProduct.reorder_level,
        createdProduct.category,
        createdProduct.is_active,
        createdProduct.supplier_id,
        createdProduct.user_id
      );
    }
    return null;
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getProductsByUserId = async (userId, filters = {}) => {
  try {
    // TODO: Challenge 02 - Implement advanced filtering and sorting
    // Currently only supports basic product retrieval by user ID
    // Participants should implement:
    // - Search functionality (name, description, SKU)
    // - Category filtering
    // - Price range filtering (minPrice, maxPrice)
    // - Sorting by different fields (name, price, stockQuantity, etc.)
    // - Pagination (page, limit)
    
    const result = await knex_db.raw(
      "SELECT * FROM product WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    return result.map((product) => new Product(
      product.id,
      product.name,
      product.description,
      product.sku,
      product.price,
      product.stock_quantity,
      product.reorder_level,
      product.category,
      product.is_active,
      product.supplier_id,
      product.user_id
    ));
  } catch (error) {
    console.error(error);
    return [];
  }
};

const getAllProducts = async () => {
  try {
    const result = await knex_db.raw(
      "SELECT * FROM product WHERE is_active = true ORDER BY created_at DESC"
    );

    return result.map((product) => new Product(
      product.id,
      product.name,
      product.description,
      product.sku,
      product.price,
      product.stock_quantity,
      product.reorder_level,
      product.category,
      product.is_active,
      product.supplier_id,
      product.user_id
    ));
  } catch (error) {
    console.error(error);
    return [];
  }
};

const getProductById = async (id) => {
  try {
    const result = await knex_db.raw(
      "SELECT * FROM product WHERE id = ? LIMIT 1",
      [id]
    );

    if (result.length > 0) {
      const product = result[0];
      return new Product(
        product.id,
        product.name,
        product.description,
        product.sku,
        product.price,
        product.stock_quantity,
        product.reorder_level,
        product.category,
        product.is_active,
        product.supplier_id,
        product.user_id
      );
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const getProductBySku = async (sku) => {
  try {
    const result = await knex_db.raw(
      "SELECT * FROM product WHERE LOWER(sku) = LOWER(?) LIMIT 1",
      [sku]
    );

    if (result.length > 0) {
      const product = result[0];
      return new Product(
        product.id,
        product.name,
        product.description,
        product.sku,
        product.price,
        product.stock_quantity,
        product.reorder_level,
        product.category,
        product.is_active,
        product.supplier_id,
        product.user_id
      );
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const updateProduct = async (id, updates) => {
  try {
    const fields = [];
    const values = [];
    
    // Build SET clause dynamically based on provided updates
    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        // Convert camelCase to snake_case for database columns
        const dbColumn = key === 'stockQuantity' ? 'stock_quantity' :
                        key === 'reorderLevel' ? 'reorder_level' :
                        key === 'isActive' ? 'is_active' :
                        key === 'supplierId' ? 'supplier_id' : key;
        
        fields.push(`${dbColumn} = ?`);
        values.push(updates[key] === undefined ? null : updates[key]);
      }
    });
    
    if (fields.length === 0) {
      return null; // No fields to update
    }
    
    fields.push('updated_at = datetime(\'now\')');
    values.push(id);
    
    const sql = `UPDATE product SET ${fields.join(', ')} WHERE id = ? RETURNING *`;
    const result = await knex_db.raw(sql, values);

    if (result.length > 0) {
      const updatedProduct = result[0];
      return new Product(
        updatedProduct.id,
        updatedProduct.name,
        updatedProduct.description,
        updatedProduct.sku,
        updatedProduct.price,
        updatedProduct.stock_quantity,
        updatedProduct.reorder_level,
        updatedProduct.category,
        updatedProduct.is_active,
        updatedProduct.supplier_id,
        updatedProduct.user_id
      );
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const deleteProduct = async (id) => {
  try {
    const result = await knex_db.raw(
      "DELETE FROM product WHERE id = ? RETURNING *",
      [id]
    );

    if (result.length > 0) {
      const product = result[0];
      return new Product(
        product.id,
        product.name,
        product.description,
        product.sku,
        product.price,
        product.stock_quantity,
        product.reorder_level,
        product.category,
        product.is_active,
        product.supplier_id,
        product.user_id
      );
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

// Business logic: Get products that need reordering
const getProductsNeedingReorder = async (userId) => {
  try {
    // TODO: Challenge 03 - Implement reorder level functionality
    // This should return products where stock_quantity <= reorder_level
    // Currently returns empty array - participants need to implement this
    
    return [];
  } catch (error) {
    console.error(error);
    return [];
  }
};

export default {
  createProduct,
  getProductsByUserId,
  getAllProducts,
  getProductById,
  getProductBySku,
  updateProduct,
  deleteProduct,
  getProductsNeedingReorder,
}; 