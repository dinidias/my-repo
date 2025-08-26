import { v4 as uuidv4 } from "uuid";
import productRepository from "../repositories/productRepository.js";
import HttpStatus from "../enums/httpStatus.js";
import Product from "../models/product.js";

const createProduct = async (req, res) => {
  try {
    const { name, description, sku, price, stockQuantity, reorderLevel, category, supplierId } = req.body;
    const userId = req.user.id;
    
    const product = new Product(uuidv4(), name, description, sku, price, stockQuantity, reorderLevel, category, true, supplierId, userId);

    
    const result = product.validateUpdate(); // Should be validateCreate()
    if (result.error) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: result.error.details[0].message });
    }

    const createdProduct = await productRepository.createProduct(product);
    if (!createdProduct) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: "Failed to create product" });
    }

    return res
      .status(HttpStatus.CREATED)
      .json({ message: "Product created successfully", data: createdProduct });
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "An error occurred", error: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // TODO: Challenge 02 - Implement advanced filtering and sorting
    // Currently only supports basic product retrieval
    // Participants should implement:
    // - Search functionality (name, description, SKU)
    // - Category filtering
    // - Price range filtering (minPrice, maxPrice)
    // - Sorting by different fields (name, price, stockQuantity, etc.)
    // - Pagination (page, limit)
    
    const products = await productRepository.getProductsByUserId(userId);

    return res
      .status(HttpStatus.OK)
      .json({ data: products });
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "An error occurred", error: error.message });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const products = await productRepository.getAllProducts();

    return res
      .status(HttpStatus.OK)
      .json({ data: products });
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "An error occurred", error: error.message });
  }
};

const getProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const product = await productRepository.getProductById(id);
    if (!product) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: "Product not found" });
    }

    // Check if product belongs to the authenticated user (only owners can modify)
    if (product.userId !== userId) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ message: "Access denied" });
    }

    return res
      .status(HttpStatus.OK)
      .json({ data: product });
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "An error occurred", error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    // First check if product exists and belongs to user
    const existingProduct = await productRepository.getProductById(id);
    if (!existingProduct) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: "Product not found" });
    }

    

    // Create product instance for validation
    const product = new Product(
      id, 
      updates.name, 
      updates.description, 
      updates.sku, 
      updates.price, 
      updates.stockQuantity, 
      updates.reorderLevel, 
      updates.category, 
      updates.isActive, 
      updates.supplierId, 
      userId
    );
    
    const result = product.validateUpdate();
    if (result.error) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: result.error.details[0].message });
    }

    const updatedProduct = await productRepository.updateProduct(id, updates);
    if (!updatedProduct) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: "Failed to update product" });
    }

    return res
      .status(HttpStatus.OK)
      .json({ message: "Product updated successfully", data: updatedProduct });
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "An error occurred", error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // First check if product exists and belongs to user
    const existingProduct = await productRepository.getProductById(id);
    if (!existingProduct) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: "Product not found" });
    }

    if (existingProduct.userId !== userId) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ message: "Access denied" });
    }

    const deletedProduct = await productRepository.deleteProduct(id);
    if (!deletedProduct) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: "Failed to delete product" });
    }

    return res
      .status(HttpStatus.OK)
      .json({ message: "Product deleted successfully" });
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "An error occurred", error: error.message });
  }
};

// Business logic endpoint: Get products that need reordering
const getProductsNeedingReorder = async (req, res) => {
  try {
    // TODO: Challenge 03 - Implement reorder level functionality
    // This endpoint should return products where stock_quantity <= reorder_level
    // Currently returns empty array - participants need to implement this
    
    return res
      .status(HttpStatus.OK)
      .json({ 
        data: [],
        message: "Reorder functionality not implemented yet"
      });
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "An error occurred", error: error.message });
  }
};

// Business logic endpoint: Update stock quantity (simulate stock movement)
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation } = req.body; // operation: 'add' or 'subtract'
    const userId = req.user.id;

    // Input validation
    if (!quantity || !Number.isInteger(quantity) || quantity <= 0) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: "quantity must be an integer greater than 0" });
    }
    
    if (!operation || !['add', 'subtract'].includes(operation)) {
      return res
        .status(HttpStatus.BAD_REQUEST)
        .json({ message: "operation must be either 'add' or 'subtract'" });
    }

    const existingProduct = await productRepository.getProductById(id);
    if (!existingProduct) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json({ message: "Product not found" });
    }

    if (existingProduct.userId !== userId) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json({ message: "Access denied" });
    }

    // Calculate new stock quantity based on operation
    let newStockQuantity = existingProduct.stockQuantity;
    if (operation === 'add') {
      newStockQuantity += quantity;
    } else if (operation === 'subtract') {
      if (existingProduct.stockQuantity < quantity) {
        return res
          .status(HttpStatus.BAD_REQUEST)
          .json({ message: "Insufficient stock" });
      }
      newStockQuantity -= quantity;
    }

    // Update the product stock using repository
    const updatedProduct = await productRepository.updateProduct(id, { stockQuantity: newStockQuantity });
    if (!updatedProduct) {
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ message: "Failed to update stock" });
    }

    return res
      .status(HttpStatus.OK)
      .json({ 
        message: `Stock ${operation === 'add' ? 'added' : 'reduced'} successfully`, 
        data: updatedProduct 
      });
  } catch (error) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: "An error occurred", error: error.message });
  }
};

export default {
  createProduct,
  getProducts,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getProductsNeedingReorder,
  updateStock,
}; 