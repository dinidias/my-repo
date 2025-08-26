/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.alterTable("user", function (table) {
    table.text("security_questions"); // JSON string to store security questions
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.alterTable("user", function (table) {
    table.dropColumn("security_questions");
  });
} 
