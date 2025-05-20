const { sequelize } = require("../../../config/db");
const { QueryTypes } = require("sequelize");

const Branch = {
  isEmailUsedBefore: async (email, callback) => {


    const emailCheckSql = `
        SELECT COUNT(*) as count
        FROM \`branches\`
        WHERE \`email\` = ?
      `;
    const emailCheckResults = await sequelize.query(emailCheckSql, {
      replacements: [email], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const emailExists = emailCheckResults[0].count > 0;
    return callback(null, emailExists);


  },

  index: async (branch_id, callback) => {

    const query = `
    SELECT 
        ca.id AS client_application_id, 
        ca.application_id,
        ca.employee_id, 
        ca.name,
        ca.status,
        ca.created_at,
        cmt.id AS cmt_id,
        cmt.*
    FROM 
        client_applications ca
    LEFT JOIN 
        cmt_applications cmt ON ca.id = cmt.client_application_id
    WHERE 
        ca.branch_id = ?
        AND ca.is_deleted != 1
    ORDER BY 
        ca.created_at DESC
  `;
    const results = await sequelize.query(query, {
      replacements: [branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    const applicationsByStatus = results.reduce((grouped, app) => {
      if (!grouped[app.status]) {
        grouped[app.status] = {
          applicationCount: 0,
          applications: [],
        };
      }

      grouped[app.status].applications.push({
        client_application_id: app.client_application_id,
        application_name: app.name,
        application_id: app.application_id,
        created_at: app.created_at,
        cmtApplicationId: app.cmt_id,
        cmtOtherFields: app.other_fields, // Adjust based on actual field names from cmt
      });

      grouped[app.status].applicationCount += 1;

      return grouped;
    }, {});

    return callback(null, applicationsByStatus);
  },

  create: async (BranchData, callback) => {

    const sqlBranch = `
        INSERT INTO \`branches\` (
          \`customer_id\`, \`name\`, \`email\`, \`is_head\`, \`password\`, \`permissions\`, \`mobile_number\`
        ) VALUES (?, ?, ?, ?, MD5(?), ?, ?)
      `;
    const permissions = `{"client_manager": true,"candidate_manager": true,"verification_status": true,"sub_user": true}`;
    const valuesBranch = [
      BranchData.customer_id,
      BranchData.name,
      BranchData.email,
      BranchData.head,
      BranchData.password,
      permissions,
      BranchData.mobile_number || null,
    ];
    const results = await sequelize.query(sqlBranch, {
      replacements: valuesBranch, // Positional replacements using ?
      type: QueryTypes.INSERT,
    });

    const branchID = results.insertId;
    callback(null, { insertId: branchID });

  },

  list: async (callback) => {
    const sql = `SELECT * FROM \`branches\``;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },

  filterOptionsForClientApplications: async (branch_id, callback) => {

    const sql = `
        SELECT \`status\`, COUNT(*) AS \`count\` 
        FROM \`client_applications\` 
        WHERE \`branch_id\` = ? AND is_deleted != 1
        GROUP BY \`status\`, \`branch_id\`
      `;
    const results = await sequelize.query(sql, {
      replacements: [branch_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    callback(null, results);


  },

  filterOptionsForCandidateApplications: async (branch_id, callback) => {
    const sql = `
        SELECT \`status\`, COUNT(*) AS \`count\` 
        FROM \`candidate_applications\` 
        WHERE \`branch_id\` = ?
        GROUP BY \`status\`, \`branch_id\`
      `;
    const results = await sequelize.query(sql, {
      replacements: [branch_id],
      type: QueryTypes.SELECT,
    });

    callback(null, results);
  },
  isEmailUsed: async (email, callback) => {
    const sql = `SELECT * FROM \`branches\` WHERE \`email\` = ?`;

    const results = await sequelize.query(sql, {
      replacements: [email],
      type: QueryTypes.SELECT,
    });
    const isUsed = results.length > 0;
    callback(null, isUsed);

  },

  isEmailUsedForUpdate: async (email, customer_id, callback) => {
    console.log("isEmailUsedForUpdate called with:");
    console.log("Email:", email);
    console.log("Customer ID:", customer_id);

    try {
      const branchQuery = `
        SELECT COUNT(*) AS count
        FROM branches
        WHERE email = ? AND customer_id != ?
      `;

      console.log("Executing SQL query:");
      console.log(branchQuery);
      console.log("With replacements:", [email, customer_id]);

      const result = await sequelize.query(branchQuery, {
        replacements: [email, customer_id],
        type: QueryTypes.SELECT,
      });

      console.log("Raw SQL result:", result);

      // Sequelize returns an array of objects; extract count
      const count = result[0]?.count || 0;
      console.log("Extracted count from result:", count);

      const isUsed = count > 0;
      console.log(`Is email "${email}" used by another customer?`, isUsed);

      return callback(null, isUsed);
    } catch (err) {
      console.error("Database query error occurred:", err);
      return callback({ message: "Database query error", error: err }, null);
    }
  },
  
  listByCustomerID: async (customer_id, callback) => {

    const sql = `SELECT * FROM \`branches\` WHERE \`customer_id\` = ?`;

    const results = await sequelize.query(sql, {
      replacements: [customer_id],
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  },

  getBranchById: async (id, callback) => {

    const sql = `SELECT \`id\`, \`customer_id\`, \`name\`, \`email\`, \`mobile_number\`, \`is_head\`, \`permissions\`, \`status\` FROM \`branches\` WHERE \`id\` = ?`;

    const results = await sequelize.query(sql, {
      replacements: [id],
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback(null, null);
    }

    callback(null, results[0]);

  },
  getClientUniqueIDByBranchId: async (id, callback) => {


    const sql = "SELECT `customer_id` FROM `branches` WHERE `id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length > 0 && results[0].customer_id) {
      const customerId = results[0].customer_id;
      const uniqueIdSql =
        "SELECT `client_unique_id` FROM `customers` WHERE `id` = ? AND is_deleted != 1";
      const uniqueIdResults = await sequelize.query(uniqueIdSql, {
        replacements: [customerId], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });

      if (
        uniqueIdResults.length > 0 &&
        uniqueIdResults[0].client_unique_id
      ) {
        return callback(null, uniqueIdResults[0].client_unique_id);
      } else {
        return callback(null, false);
      }

    } else {
      // Ensure connection is released
      return callback(null, false);
    }


  },

  getClientNameByBranchId: async (id, callback) => {

    const sql = "SELECT `customer_id` FROM `branches` WHERE `id` = ?";
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });


    if (results.length > 0 && results[0].customer_id) {
      const customerId = results[0].customer_id;
      const uniqueIdSql = "SELECT `name` FROM `customers` WHERE `id` = ? AND is_deleted != 1";
      const uniqueIdResults = await sequelize.query(uniqueIdSql, {
        replacements: [customerId], // Positional replacements using ?
        type: QueryTypes.SELECT,
      });

      if (uniqueIdResults.length > 0 && uniqueIdResults[0].name) {
        return callback(null, uniqueIdResults[0].name);
      } else {
        return callback(null, false);
      }

    } else {
      // Ensure connection is released
      return callback(null, false);
    }
    ;

  },

  update: async (id, name, email, password, callback) => {
    const sql = `
        UPDATE \`branches\`
        SET \`name\` = ?, \`email\` = ?, \`password\` = ?
        WHERE \`id\` = ?
      `;
    const results = await sequelize.query(sql, {
      replacements: [name, email, password, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },

  updateHeadBranchEmail: async (customer_id, name, email, callback) => {
    const sql = `
        UPDATE \`branches\`
        SET \`name\` = ?, \`email\` = ?
        WHERE \`is_head\` = ? AND \`customer_id\` = ?
      `;
    const results = await sequelize.query(sql, {
      replacements: [name, email, "1", customer_id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    callback(null, results);

  },

  active: async (id, callback) => {
    const sql = `
        UPDATE \`branches\`
        SET \`status\` = ?
        WHERE \`id\` = ?
      `;
    const results = await sequelize.query(sql, {
      replacements: ["1", id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });

    callback(null, results);

  },

  inactive: async (id, callback) => {
    const sql = `
        UPDATE \`branches\`
        SET \`status\` = ?
        WHERE \`id\` = ?
      `;
    const results = await sequelize.query(sql, {
      replacements: ["0", id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },

  delete: async (id, callback) => {

    const checkSql = `SELECT \`is_head\` FROM \`branches\` WHERE \`id\` = ?`;
    const results = await sequelize.query(checkSql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    if (results.length === 0) {
      return callback({ message: "Branch not found" }, null);
    }

    if (results[0].is_head === 1) {
      return callback({ message: "Can't delete head branch" }, null);
    }
    const deleteSql = `DELETE FROM \`branches\` WHERE \`id\` = ?`;
    const deleteResults = await sequelize.query(deleteSql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });
    callback(null, deleteResults);



  },
};

module.exports = Branch;
