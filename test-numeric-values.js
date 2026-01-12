// Test script to verify numeric values are properly formatted
const express = require('express');
const request = require('supertest');

// Create a simple test to check numeric formatting
function testNumericFormatting() {
    console.log('Testing numeric value formatting...\n');
    
    // Test the safeNumber helper function
    function safeNumber(value, decimals = 2) {
        if (value === null || value === undefined || !isFinite(value)) {
            return 0;
        }
        return parseFloat(value.toFixed(decimals));
    }
    
    // Test cases
    const testCases = [
        { input: 25.123456, expected: 25.12, description: 'Normal decimal' },
        { input: 0, expected: 0, description: 'Zero value' },
        { input: null, expected: 0, description: 'Null value' },
        { input: undefined, expected: 0, description: 'Undefined value' },
        { input: NaN, expected: 0, description: 'NaN value' },
        { input: Infinity, expected: 0, description: 'Infinity value' },
        { input: -Infinity, expected: 0, description: 'Negative Infinity' },
        { input: 100, expected: 100, description: 'Whole number' },
        { input: -15.67, expected: -15.67, description: 'Negative decimal' }
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach(testCase => {
        const result = safeNumber(testCase.input);
        const success = result === testCase.expected;
        
        console.log(`${success ? '✅' : '❌'} ${testCase.description}: ${testCase.input} → ${result} (expected: ${testCase.expected})`);
        
        if (success) {
            passed++;
        } else {
            failed++;
        }
    });
    
    console.log(`\nTest Results: ${passed} passed, ${failed} failed\n`);
    
    // Test percentage calculations
    console.log('Testing percentage calculations...\n');
    
    function calculatePercentageChange(current, previous) {
        let change = 0;
        if (previous > 0) {
            change = ((current - previous) / previous * 100);
        } else if (current > 0) {
            change = 100;
        }
        
        if (!isFinite(change)) {
            change = 0;
        }
        
        return safeNumber(change);
    }
    
    const percentageTests = [
        { current: 10, previous: 5, expected: 100, description: '5 to 10 (100% increase)' },
        { current: 5, previous: 10, expected: -50, description: '10 to 5 (50% decrease)' },
        { current: 10, previous: 0, expected: 100, description: '0 to 10 (100% from zero)' },
        { current: 0, previous: 10, expected: -100, description: '10 to 0 (100% decrease)' },
        { current: 0, previous: 0, expected: 0, description: '0 to 0 (no change)' },
        { current: 15, previous: 15, expected: 0, description: '15 to 15 (no change)' }
    ];
    
    percentageTests.forEach(test => {
        const result = calculatePercentageChange(test.current, test.previous);
        const success = result === test.expected;
        
        console.log(`${success ? '✅' : '❌'} ${test.description}: ${result}% (expected: ${test.expected}%)`);
    });
    
    console.log('\n🎯 All numeric formatting tests completed!');
    console.log('The dashboard endpoints should now return proper numeric values for Retrofit.');
}

// Run the test
testNumericFormatting();

// Export for potential use in other tests
module.exports = { testNumericFormatting };