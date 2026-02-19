const request = require('supertest');
const app = require('./index'); // Your Express app

// Test the print endpoint
async function testPrintAPI() {
    console.log('Testing Print API...');
    
    // This is a basic test - you'll need to adjust based on your auth setup
    const response = await request(app)
        .post('/api/print/generate-faas')
        .send({ recordId: 1 })
        .set('Content-Type', 'application/json');
    
    console.log('Response:', response.body);
}

testPrintAPI();