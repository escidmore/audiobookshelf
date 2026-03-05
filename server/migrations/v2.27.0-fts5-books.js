/**
 * @typedef MigrationContext
 * @property {import('sequelize').QueryInterface} queryInterface - a sequelize QueryInterface object.
 * @property {import('../Logger')} logger - a Logger object.
 *
 * @typedef MigrationOptions
 * @property {MigrationContext} context - an object containing the migration context.
 */

const migrationVersion = '2.27.0'
const migrationName = `${migrationVersion}-fts5-books`
const loggerPrefix = `[${migrationVersion} migration]`

/**
 * This upward migration creates the fts_books FTS5 virtual table and backfills all
 * existing book rows.
 *
 * The table is a standalone FTS5 table (no content= option) because `books` has no
 * authorNames column — authors live in `authors` joined via `bookAuthors`. The full
 * content is stored in the FTS index itself and kept in sync by triggers that live in
 * Database.addFts5BookTriggers() (idempotent, no migration bump needed for trigger changes).
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function up({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} UPGRADE BEGIN: ${migrationName}`)

  await queryInterface.sequelize.query(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_books
      USING fts5(
        title, titleIgnorePrefix, subtitle, description, publisher,
        authorNames, narrators, genres, tags,
        tokenize='unicode61 remove_diacritics 2'
      )
  `)
  logger.info(`${loggerPrefix} Created fts_books virtual table`)

  await queryInterface.sequelize.query(`
    INSERT INTO fts_books(rowid, title, titleIgnorePrefix, subtitle, description, publisher, authorNames, narrators, genres, tags)
    SELECT
      b.rowid,
      b.title,
      b.titleIgnorePrefix,
      b.subtitle,
      b.description,
      b.publisher,
      (SELECT GROUP_CONCAT(a.name, ', ')
       FROM authors a
       JOIN bookAuthors ba ON ba.authorId = a.id
       WHERE ba.bookId = b.id),
      b.narrators,
      b.genres,
      b.tags
    FROM books b
  `)
  logger.info(`${loggerPrefix} Backfilled all existing book rows into fts_books`)

  logger.info(`${loggerPrefix} UPGRADE END: ${migrationName}`)
}

/**
 * This downward migration drops the fts_books virtual table.
 * Triggers are owned by Database.addFts5BookTriggers(), not this migration,
 * so they are NOT dropped here.
 *
 * @param {MigrationOptions} options - an object containing the migration context.
 * @returns {Promise<void>} - A promise that resolves when the migration is complete.
 */
async function down({ context: { queryInterface, logger } }) {
  logger.info(`${loggerPrefix} DOWNGRADE BEGIN: ${migrationName}`)

  await queryInterface.sequelize.query(`DROP TABLE IF EXISTS fts_books`)
  logger.info(`${loggerPrefix} Dropped fts_books virtual table`)

  logger.info(`${loggerPrefix} DOWNGRADE END: ${migrationName}`)
}

module.exports = { up, down }
