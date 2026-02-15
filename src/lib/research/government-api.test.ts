/**
 * Test file for Government API integration
 * 
 * This file tests the government API client to ensure it's working correctly.
 * Update the API_BASE_URL and API_KEY (if needed) to match your government API.
 * 
 * Common Government APIs:
 * - data.gov APIs (https://www.data.gov/developers/apis)
 * - Census Bureau API (https://www.census.gov/data/developers/data-sets.html)
 * - Federal Register API (https://www.federalregister.gov/api/v1)
 * - Regulations.gov API (https://www.regulations.gov/docs/api)
 */

// Configuration - Update these with your API details
const API_BASE_URL = process.env.GOVERNMENT_API_URL || 'https://api.example.gov/v1';
const API_KEY = process.env.GOVERNMENT_API_KEY || 'your-api-key-here';

interface GovernmentApiResponse {
  data?: unknown;
  results?: unknown[];
  error?: string;
  status?: string;
}

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  response?: unknown;
}

/**
 * Test the government API with a simple query
 */
export async function testGovernmentApi(
  endpoint: string = '/search',
  queryParams?: Record<string, string>
): Promise<TestResult> {
  const testName = `Government API Test - ${endpoint}`;
  
  try {
    // Build URL with query parameters
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    // Make the API request
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add API key if required (common patterns)
    if (API_KEY && API_KEY !== 'your-api-key-here') {
      // Some APIs use different header names - adjust as needed
      headers['X-API-Key'] = API_KEY;
      // Or: headers['Authorization'] = `Bearer ${API_KEY}`;
      // Or: headers['Authorization'] = `API-Key ${API_KEY}`;
    }

    console.log(`Testing: ${url.toString()}`);
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      throw new Error(
        `API request failed with status ${response.status}: ${errorText}`
      );
    }

    const data: GovernmentApiResponse = await response.json();

    return {
      testName,
      passed: true,
      response: data,
    };
  } catch (error) {
    return {
      testName,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test multiple endpoints
 */
export async function runAllTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: Basic search endpoint
  results.push(
    await testGovernmentApi('/search', {
      q: 'artificial intelligence regulation',
      limit: '10',
    })
  );

  // Test 2: Get specific resource (adjust endpoint as needed)
  // results.push(
  //   await testGovernmentApi('/documents/12345')
  // );

  // Test 3: List endpoint
  // results.push(
  //   await testGovernmentApi('/documents', {
  //     page: '1',
  //     per_page: '20',
  //   })
  // );

  return results;
}

/**
 * Run tests and print results
 */
export async function runTests(): Promise<void> {
  console.log('🧪 Starting Government API Tests...\n');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`API Key: ${API_KEY ? '***' + API_KEY.slice(-4) : 'Not set'}\n`);

  const results = await runAllTests();

  console.log('\n📊 Test Results:');
  console.log('='.repeat(50));

  let passedCount = 0;
  let failedCount = 0;

  results.forEach((result) => {
    if (result.passed) {
      console.log(`✅ ${result.testName}`);
      passedCount++;
    } else {
      console.log(`❌ ${result.testName}`);
      console.log(`   Error: ${result.error}`);
      failedCount++;
    }
  });

  console.log('='.repeat(50));
  console.log(`\nTotal: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.log('\n⚠️  Some tests failed. Check your API configuration.');
    process.exit(1);
  } else {
    console.log('\n✨ All tests passed!');
  }
}

// Run tests if this file is executed directly (Node.js)
// For Next.js/TypeScript, you can import and call runTests() from another file
if (typeof require !== 'undefined' && require.main === module) {
  runTests().catch((error) => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}

