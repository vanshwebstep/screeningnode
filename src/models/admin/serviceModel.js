const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");
const Service = {
  isServiceCodeUnique: async (service_code, callback) => {
    const serviceCodeCheckSql = `
        SELECT COUNT(*) as count
        FROM \`services\`
        WHERE \`service_code\` = ?
      `;
    const serviceCodeCheckResults = await sequelize.query(serviceCodeCheckSql, {
      replacements: [service_code], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    const serviceCodeExists = serviceCodeCheckResults[0].count > 0;
    return callback(null, serviceCodeExists);
  },

  create: async (
    title,
    description,
    group_id,
    service_code,
    hsn_code,
    admin_id,
    callback
  ) => {
    // Step 1: Check if a service with the same title already exists
    const checkServiceSql = `
      SELECT * FROM \`services\` WHERE \`title\` = ? OR \`service_code\` = ?
    `;
    const serviceResults = await sequelize.query(checkServiceSql, {
      replacements: [title, service_code], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });

    // Step 2: If a service with the same title exists, return an error
    if (serviceResults.length > 0) {
      const error = new Error(
        "Service with the same name or service code already exists"
      );
      console.error(error.message);
      return callback(error, null);
    }

    const insertServiceSql = `
          INSERT INTO \`services\` (\`title\`, \`description\`, \`group_id\`, \`service_code\`,  \`hsn_code\`, \`admin_id\`)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
    const results = await sequelize.query(insertServiceSql, {
      replacements: [title, description, group_id, service_code, hsn_code, admin_id], // Positional replacements using ?
      type: QueryTypes.INSERT,
    });
    callback(null, results);

  },

  list: async (callback) => {
    const sql = `
      SELECT 
        s.*, 
        sg.title AS group_name 
      FROM \`services\` s
      JOIN \`service_groups\` sg ON s.group_id = sg.id
    `;


    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });

    callback(null, results);

  },

  digitlAddressService: async (callback) => {
    const sql = `
      SELECT * FROM \`services\`
      WHERE LOWER(\`title\`) LIKE '%digital%'
      AND (LOWER(\`title\`) LIKE '%verification%' OR LOWER(\`title\`) LIKE '%address%')
      LIMIT 1
    `;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    const singleEntry = results.length > 0 ? results[0] : null;
    callback(null, singleEntry); // Return single entry or null if not found


  },

  getServiceById: async (id, callback) => {
    const sql = `SELECT * FROM \`services\` WHERE \`id\` = ?`;
    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);
  },

  getServiceRequiredDocumentsByServiceId: async (service_id, callback) => {
    const sql = `SELECT * FROM \`service_required_documents\` WHERE \`service_id\` = ?`;
    const results = await sequelize.query(sql, {
      replacements: [service_id], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
    callback(null, results[0]);

  },

  update: async (
    id,
    title,
    description,
    group_id,
    service_code,
    hsn_code,
    callback
  ) => {
    const sql = `
      UPDATE \`services\`
      SET \`title\` = ?, \`description\` = ?, \`group_id\` = ?, \`service_code\` = ?, \`hsn_code\` = ?
      WHERE \`id\` = ?
    `;
    const results = await sequelize.query(sql, {
      replacements: [title, description, group_id, service_code, hsn_code, id], // Positional replacements using ?
      type: QueryTypes.UPDATE,
    });
    callback(null, results);
  },

  delete: async (id, callback) => {
    const sql = `
      DELETE FROM \`services\`
      WHERE \`id\` = ?
    `;


    const results = await sequelize.query(sql, {
      replacements: [id], // Positional replacements using ?
      type: QueryTypes.DELETE,
    });
    callback(null, results);

  },

  servicesWithGroup: async (callback) => {
    const sql = `
      SELECT 
        sg.id AS group_id, 
        sg.symbol, 
        sg.title AS group_title, 
        s.id AS service_id, 
        s.title AS service_title,
        s.service_code AS service_code
      FROM 
        service_groups sg
      LEFT JOIN 
        services s ON s.group_id = sg.id
      ORDER BY 
        sg.id, s.id
    `;
    const results = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
    });
    const groupedData = [];
    const groupMap = new Map();

    results.forEach((row) => {
      const {
        group_id,
        symbol,
        group_title,
        service_id,
        service_title,
        service_code,
      } = row;

      // Retrieve the group from the map, or initialize a new entry
      let group = groupMap.get(group_id);
      if (!group) {
        group = {
          group_id,
          symbol,
          group_title,
          services: [],
        };
        groupMap.set(group_id, group);
        groupedData.push(group);
      }

      // Add service details if the service exists
      if (service_id) {
        group.services.push({
          service_id,
          service_title,
          service_code,
        });
      }
    });

    callback(null, groupedData);


  },
};

module.exports = Service;
