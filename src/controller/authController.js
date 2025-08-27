import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import userRepository from "../repositories/userRepository.js";
import HttpStatus from "../enums/httpStatus.js";
import User from "../models/user.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Password validation
function validatePassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return regex.test(password);
}

const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, password, securityQuestions } = req.body;

    // Password validation
    if (!validatePassword(password)) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      });
    }

    // Check if user already exists
    const existingUser = await userRepository.getUserByEmail(email);
    if (existingUser) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object
    const user = new User(uuidv4(), email, firstName, lastName, hashedPassword, false, securityQuestions);

    // Save user
    const userCreated = await userRepository.createUser(user);
    if (!userCreated) throw new Error("User creation failed");

    return res.status(HttpStatus.CREATED).json({ message: "User created successfully" });
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "An error occurred", error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userRepository.getUserByEmail(email);
    if (!user) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid email or password" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid email or password" });
    }

    // Remove password from response
    const { password: userPassword, ...userWithoutPassword } = user;

    // Generate JWT
    const token = jwt.sign({ user: userWithoutPassword }, process.env.JWT_PRIVATE_KEY, { expiresIn: "7d" });

    return res.status(HttpStatus.OK).json({ data: { user: userWithoutPassword, token } });
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "An error occurred", error: error.message });
  }
};

const verifySecurityQuestion = async (req, res) => {
  try {
    const { email, questionId, answer } = req.body;

    const user = await userRepository.getUserByEmail(email);
    if (!user) return res.status(HttpStatus.BAD_REQUEST).json({ message: "User not found", verified: false });

    const securityQuestion = user.securityQuestions?.find(q => q.questionId === questionId);
    if (!securityQuestion) return res.status(HttpStatus.BAD_REQUEST).json({ message: "Security question not found", verified: false });

    // Apply transformation based on last name's first letter
    const lastName = user.lastName.toLowerCase();
    const firstLetter = lastName.charAt(0);
    let expectedAnswer = securityQuestion.answer.toLowerCase();

    if (firstLetter >= 't' && firstLetter <= 'z') {
      expectedAnswer = securityQuestion.answer.toUpperCase();
    } else if (firstLetter >= 'n' && firstLetter <= 's') {
      expectedAnswer = securityQuestion.answer.split('').reverse().join('');
    } else if (firstLetter >= 'g' && firstLetter <= 'm') {
      const chars = securityQuestion.answer.split('');
      if (chars.length > 1) {
        const first = chars[0];
        const last = chars[chars.length - 1];
        chars[0] = last;
        chars[chars.length - 1] = first;
        expectedAnswer = chars.join('');
      }
    }
    // A-F: use as-is

    if (answer === expectedAnswer) {
      return res.status(HttpStatus.OK).json({ message: "Security question verified", verified: true });
    } else {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Incorrect answer", verified: false });
    }
  } catch (error) {
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "An error occurred", error: error.message });
  }
};

export default { signup, login, verifySecurityQuestion };
