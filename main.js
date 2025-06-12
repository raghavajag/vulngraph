const express = require('express');
const mysql = require('mysql');
const { exec } = require('child_process');

const app = express();

// --- Helper & Utility Functions ---

/**
 * A simple (and ineffective) sanitizer.
 * The graph should identify this as a SANITIZER node.
 */
function sanitizeInput(data) {
    // This is a weak sanitizer for testing purposes.
    return data.replace(/'/g, "''");
}

/**
 * Builds a database query. This is part of the data flow chain.
 * The graph should show that handleRequest calls this function.
 */
function buildQuery(tableName, input) {
    // This function transforms the input into a final query.
    const rawQuery = `SELECT * FROM ${tableName} WHERE username = '${input}'`;
    return rawQuery;
}

/**
 * Executes a database command. This is the SINK for the SQLi.
 */
function executeDbCommand(query, connection) {
    connection.query(query, (error, results) => {
        if (error) {
            console.error("DB Error:", error);
            return;
        }
        console.log("DB Results:", results);
    });
}

// --- Main Request Handler ---

/**
 * Main handler that contains complex logic to test the graph builder.
 */
function handleRequest(req, res) {
    // SOURCE: User input from a query parameter.
    const userInput = req.query.user;
    let finalPayload;

    // CONTROL FLOW (BRANCH): Check if the user is an admin.
    if (req.query.role === 'admin') {
        // This path involves a transformation.
        const processedInput = userInput.toLowerCase(); // TRANSFORMER node
        finalPayload = processedInput;
    } else {
        // The "safe" path uses the sanitizer.
        const sanitized = sanitizeInput(userInput); // SANITIZER node
        finalPayload = sanitized;
    }

    try {
        // --- Vulnerability 1: SQL Injection ---
        const connection = mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "hardcoded_password_123" // Another finding for secrets
        });

        // CALL to a helper function, continuing the data flow.
        const sqlQuery = buildQuery("users", finalPayload);
        
        // SINK for SQLi. Data flows from finalPayload into this function call.
        executeDbCommand(sqlQuery, connection);


        // --- Vulnerability 2: Cross-Site Scripting (XSS) ---
        // SINK for XSS. The same payload is used here.
        res.send(`<h1>Welcome, ${finalPayload}!</h1>`);

    } catch (e) {
        res.status(500).send("An error occurred.");
    }
}


// --- Command Injection Endpoint (Simpler Flow) ---
app.get('/api/run-command', (req, res) => {
    // SOURCE
    const userCommand = req.query.cmd;

    // SINK for Command Injection
    exec(`ls -l ${userCommand}`, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).send(`Error: ${error.message}`);
        }
        res.send(`<pre>${stdout}</pre>`);
    });
});


// Register the main handler for the primary test endpoint.
app.get('/api/user-data', handleRequest);

app.listen(3000, () => {
    console.log('Benchmark server running on port 3000');
});
