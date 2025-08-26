import Joi from "joi";

class User {
  constructor(id, email, firstName, lastName, password, isAdmin = false, securityQuestions = []) {
    this.id = id;
    this.email = email;
    this.firstName = firstName;
    this.lastName = lastName;
    this.password = password;
    this.isAdmin = isAdmin;
    this.securityQuestions = securityQuestions;
    
    
  }

  validate = () => {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
      email: Joi.string().email().required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      isAdmin: Joi.boolean().required(),
    });

    return schema.validate({
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      isAdmin: this.isAdmin,
    });
  };

  validateSignup = () => {
    // Custom password validation with specific error messages
    const passwordValidation = this.validatePasswordComplexity(this.password);
    if (passwordValidation.error) {
      return { error: { details: [{ message: passwordValidation.error }] } };
    }

    const schema = Joi.object({
      firstName: Joi.string().min(2).max(30).required(),
      lastName: Joi.string().min(2).max(30).required(),
      email: Joi.string().email().required(),
      password: Joi.string().required(),
      securityQuestions: Joi.array().items(
        Joi.object({
          questionId: Joi.string().required(),
          answer: Joi.string().required()
        })
      ).optional()
    });

    return schema.validate({
      email: this.email,
      password: this.password,
      firstName: this.firstName,
      lastName: this.lastName,
      securityQuestions: this.securityQuestions
    });
  };

  validatePasswordComplexity = (password) => {
    if (!password || password.length < 6) { 
      return { error: "Password must be at least 6 characters in length" }; 
    }
    
    
    
    if (!/[a-z]/.test(password)) {
      return { error: "Password must contain at least one lowercase letter" };
    }
    
   
    return { valid: true };
  };

  validateLogin = () => {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    });

    return schema.validate({
      email: this.email,
      password: this.password,
    });
  };

  validateId = () => {
    const schema = Joi.object({
      id: Joi.string().uuid().required(),
    });

    const validate = schema.validate({ id: this.id });

    if (validate.error) return validate.error.details[0].message;
  };
}

export default User;
