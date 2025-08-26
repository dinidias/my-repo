import knex_db from "../../db/db-config.js";
import User from "../models/user.js";

const createUser = async (user) => {
  const { id, firstName, lastName, email, password, securityQuestions } = user;
  try {
    const securityQuestionsJson = securityQuestions ? JSON.stringify(securityQuestions) : null;
    const result = await knex_db.raw(
      "INSERT INTO user (id, first_name, last_name, email, password, security_questions) VALUES (?,?,?,?,?,?) RETURNING id",
      [id, firstName, lastName, email, password, securityQuestionsJson]
    );

    return result[0];
  } catch (error) {
    console.log(error);
    return null;
  }
};

const getUserByEmail = async (email) => {
  try {
    const result = await knex_db.raw("SELECT * FROM user WHERE email = ?", [
      email,
    ]);
    if (result.length > 0) {
      const securityQuestions = result[0].security_questions ? 
        JSON.parse(result[0].security_questions) : [];
      
      return new User(
        result[0].id,
        result[0].email,
        result[0].first_name,
        result[0].last_name,
        result[0].password,
        result[0].is_admin,
        securityQuestions
      );
    }
  } catch (error) {
    console.error(error);
    return null;
  }
};

const getUserById = async (id) => {
  try {
    const response = await knex_db.raw(
      `SELECT * FROM user WHERE id = ?`,
      [id]
    );

    if (response.length === 0) return null;

    return new User(
      response[0].id,
      response[0].email,
      response[0].first_name,
      response[0].last_name,
      "",
      response[0].is_admin
    );
  } catch (error) {
    console.error(error);
    return null;
  }
};

export default {
  createUser,
  getUserByEmail,
  getUserById,
  // Add the new functions here
};
