const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize");


// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const recordTrackerModel = {
  recordTracker: async (customerId, month, year, callback) => {
    // Start connection to the database
   

      // Select only necessary customer details
      const customerQuery = `
       SELECT 
        c.id, 
        c.client_unique_id, 
        c.name, 
        c.emails, 
        c.mobile, 
        c.services, 
        cm.address, 
        cm.contact_person_name, 
        cm.escalation_point_contact, 
        cm.single_point_of_contact, 
        cm.gst_number,
        cm.payment_contact_person,
        cm.state,
        cm.state_code
      FROM customers c
      LEFT JOIN customer_metas cm ON cm.customer_id = c.id
      WHERE c.id = ? AND c.is_deleted != 1;
    `;
    const customerResults = await sequelize.query(customerQuery, {
      replacements: [customerId], // Positional replacements using ?
      type: QueryTypes.SELECT,
    });
      
        if (customerResults.length === 0) {
          
          return callback(new Error("Customer not found."), null);
        }

        const customerData = customerResults[0];

        let servicesData;
        try {
          servicesData = JSON.parse(customerData.services);
        } catch (parseError) {
          
          return callback(parseError, null);
        }

        const updateServiceTitles = async () => {
          try {
            for (const group of servicesData) {
              for (const service of group.services) {
                const serviceSql = `SELECT title FROM services WHERE id = ?`;

                const [rows] = await new Promise(async (resolve) => {
                  const results = await sequelize.query(serviceSql, {
                    replacements: [service.serviceId], // Positional replacements using ?
                    type: QueryTypes.SELECT,
                  });
                      resolve(results);
                });
                if (rows && rows.title) {
                  service.serviceTitle = rows.title;
                }
              }
            }
          } catch (err) {
            console.error("Error updating service titles:", err);
          } finally {
            

            customerData.services = JSON.stringify(servicesData);
            const applicationQuery = `
            SELECT
              ca.id,
              ca.branch_id,
              ca.application_id,
              ca.employee_id,
              ca.name,
              ca.services,
              ca.status,
              ca.created_at,
              cmt.report_date
            FROM 
              client_applications ca
            LEFT JOIN 
              cmt_applications cmt ON cmt.client_application_id = ca.id
            WHERE 
              ca.status IN ('completed', 'closed', 'complete') 
              AND ca.customer_id = ?
              AND MONTH(cmt.report_date) = ?
              AND YEAR(cmt.report_date) = ? 
              AND ca.is_deleted != 1
            ORDER BY ca.branch_id;
          `;
          const applicationResults = await sequelize.query(applicationQuery, {
            replacements: [customerId, month, year], // Positional replacements using ?
            type: QueryTypes.SELECT,
          });
          
                const branchApplicationsMap = {};

                applicationResults.forEach((application) => {
                  const branchId = application.branch_id;
                  if (!branchApplicationsMap[branchId]) {
                    branchApplicationsMap[branchId] = {
                      id: branchId,
                      applications: [],
                    };
                  }

                  // Initialize statusDetails if not already initialized
                  application.statusDetails = application.statusDetails || [];

                  // Push the application into the corresponding branch's array
                  branchApplicationsMap[branchId].applications.push(
                    application
                  );
                });

                // Prepare to fetch branch details for each unique branch ID
                const branchesWithApplications = [];
                const branchIds = Object.keys(branchApplicationsMap);
                const branchPromises = branchIds.map((branchId) => {
                  return new Promise(async (resolve) => {
                    const branchQuery = `
                  SELECT id, name 
                  FROM branches 
                  WHERE id = ?;
                `;
                const branchResults = await sequelize.query(branchQuery, {
                  replacements: [branchId], // Positional replacements using ?
                  type: QueryTypes.SELECT,
                });
                    
                        if (branchResults.length > 0) {
                          const branch = branchResults[0];
                          branchesWithApplications.push({
                            id: branch.id,
                            name: branch.name,
                            applications:
                              branchApplicationsMap[branchId].applications,
                          });
                        }
                        resolve();
                      
                  });
                });

                // Process each application's services and fetch status from the appropriate table
                const applicationServicePromises = applicationResults.map(
                  (application) => {
                    const services = application.services.split(",");
                    const servicePromises = services.map((serviceId) => {
                      return new Promise(async (resolve, reject) => {
                        const reportFormQuery = `
                        SELECT json
                        FROM report_forms
                        WHERE service_id = ?;
                      `;
                      const reportFormResults = await sequelize.query(reportFormQuery, {
                        replacements: [serviceId], // Positional replacements using ?
                        type: QueryTypes.SELECT,
                      });

                            if (reportFormResults.length > 0) {
                              // Parse JSON to extract db_table
                              const reportFormJson = JSON.parse(
                                reportFormResults[0].json
                              );
                              const dbTable = reportFormJson.db_table;

                              // Query to find the column that starts with "additional_fee"
                              const additionalFeeColumnQuery = `SHOW COLUMNS FROM \`${dbTable}\` WHERE \`Field\` LIKE 'additional_fee%'`;
                              const columnResults = await sequelize.query(additionalFeeColumnQuery, {
                                type: QueryTypes.SELECT,
                              });
                                  // Identify the additional_fee column
                                  const additionalFeeColumn =
                                    columnResults.length > 0
                                      ? columnResults[0].Field
                                      : null;

                                  // Construct the query with a fixed "status" column and dynamic "additional_fee" column
                                  const statusQuery = `
                                SELECT status${
                                  additionalFeeColumn
                                    ? `, ${additionalFeeColumn}`
                                    : ""
                                }
                                FROM ${dbTable}
                                WHERE client_application_id = ?;
                              `;
                              const statusResults = await sequelize.query(statusQuery, {
                                replacements: [application.id], // Positional replacements using ?
                                type: QueryTypes.SELECT,
                              });
                                  
                                      console.warn(
                                        `SELECT status${
                                          additionalFeeColumn
                                            ? `, ${additionalFeeColumn}`
                                            : ""
                                        } FROM ${dbTable} WHERE client_application_id = ${
                                          application.id
                                        };`
                                      );
                                   

                                      // Append the status and additional_fee to the application object
                                      application.statusDetails.push({
                                        serviceId,
                                        status:
                                          statusResults.length > 0
                                            ? statusResults[0].status
                                            : null,
                                        additionalFee:
                                          additionalFeeColumn &&
                                          statusResults.length > 0
                                            ? statusResults[0][
                                                additionalFeeColumn
                                              ]
                                            : null,
                                      });

                                      resolve();
                                 
                            } else {
                              resolve();
                            }
                        
                      });
                    });

                    return Promise.all(servicePromises);
                  }
                );

                Promise.all(applicationServicePromises)
                  .then(() => Promise.all(branchPromises))
                  .then(() => {
                    // Compile the final results
                    const finalResults = {
                      customerInfo: customerData,
                      applicationsByBranch: branchesWithApplications,
                    };
                    
                    callback(null, finalResults);
                  })
                  .catch((err) => {
                    
                    console.error(
                      "Error while fetching branch or service details:",
                      err
                    );
                    callback(err, null);
                  });
             
          }
        };

        updateServiceTitles();
    
  
  },

  list:async (month, year, callback) => {

      // If no filter_status is provided, proceed with the final SQL query without filters
      const finalSql = `
                          WITH BranchesCTE AS (
                            SELECT 
                                b.id AS branch_id,
                                b.customer_id
                            FROM 
                                branches b
                        )
                        SELECT 
                            customers.client_unique_id,
                            customers.name,
                            customer_metas.tat_days,
                            customer_metas.single_point_of_contact,
                            customer_metas.client_spoc_name,
                            customers.id AS main_id,
                            COALESCE(branch_counts.branch_count, 0) AS branch_count,
                            COALESCE(application_counts.application_count, 0) AS application_count
                        FROM 
                            customers
                        LEFT JOIN 
                            customer_metas 
                            ON customers.id = customer_metas.customer_id
                        LEFT JOIN (
                            SELECT 
                                customer_id, 
                                COUNT(*) AS branch_count
                            FROM 
                                branches
                            GROUP BY 
                                customer_id
                        ) AS branch_counts 
                            ON customers.id = branch_counts.customer_id
                        LEFT JOIN (
                            SELECT 
                                b.customer_id, 
                                COUNT(ca.id) AS application_count,
                                MAX(ca.created_at) AS latest_application_date
                            FROM 
                                BranchesCTE b
                            INNER JOIN 
                                client_applications ca 
                                ON b.branch_id = ca.branch_id
                            INNER JOIN
                                cmt_applications cmt 
                                ON ca.id = cmt.client_application_id
                            WHERE
                                ca.is_data_qc = 1
                                AND ca.status IN ('complete', 'completed', 'closed')
                                AND MONTH(cmt.report_date) = ?
                                AND YEAR(cmt.report_date) = ? 
                                AND ca.is_deleted != 1
                            GROUP BY 
                                b.customer_id
                        ) AS application_counts 
                            ON customers.id = application_counts.customer_id
                        WHERE 
                            COALESCE(application_counts.application_count, 0) > 0
                            AND customers.is_deleted != 1
                        ORDER BY 
                            application_counts.latest_application_date DESC;
        `;

        const results = await sequelize.query(finalSql, {
          replacements: [month, year], // Positional replacements using ?
          type: QueryTypes.SELECT,
        });

          for (const result of results) {

          if (result.branch_count === 1) {
            // Query client_spoc table to fetch names for these IDs
            const headBranchQuery = `SELECT id, is_head FROM \`branches\` WHERE \`customer_id\` = ? AND \`is_head\` = ?`;

            try {
              const headBranchID = await new Promise(async(resolve, reject) => {

                const headBranchResults = await sequelize.query(headBranchQuery, {
                  replacements: [result.main_id, 1], // Positional replacements using ?
                  type: QueryTypes.SELECT,
                });
                    resolve(
                      headBranchResults.length > 0
                        ? headBranchResults[0].id
                        : null
                    );
              });

              result.head_branch_id = headBranchID;
            } catch (headBranchErr) {
              console.error("Error fetching head branch id:", headBranchErr);
              result.head_branch_id = null; // Default to null if an error occurs
            }
          }
        }

        callback(null, results);
      
   
  },
};

module.exports = recordTrackerModel;
