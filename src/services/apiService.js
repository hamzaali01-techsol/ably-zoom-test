/**
 * Service for making API requests to the backend
 */

/**
 * Makes an API request to the backend
 * @param {object} config - Endpoint configuration with method, path, pathParams, bodyParams
 * @param {object} params - Parameter values for path and body
 * @returns {Promise<object>} Response JSON
 * @throws {Error} If request fails
 */
export async function apiRequest(config, params = {}) {
  const { method = "POST", path = "", pathParams = [], bodyParams = [] } = config;

  // Get base URL and auth token from localStorage
  const baseUrl = localStorage.getItem("apiBaseUrl") || "https://localhost:7288";
  const authToken = localStorage.getItem("authToken") || "";

  // Build URL by replacing path parameters
  let url = path;
  pathParams.forEach(param => {
    if (params[param] !== undefined && params[param] !== null) {
      url = url.replace(`{${param}}`, encodeURIComponent(params[param]));
    }
  });

  // Build request options
  const options = {
    method: method.toUpperCase(),
    headers: {
      "Content-Type": "application/json"
    }
  };

  // Add auth header if token exists
  if (authToken) {
    options.headers["Authorization"] = `Bearer ${authToken}`;
  }

  // Add body for POST/PUT requests
  if (method.toUpperCase() !== "GET" && bodyParams.length > 0) {
    const body = {};
    bodyParams.forEach(param => {
      if (params[param] !== undefined && params[param] !== null) {
        body[param] = params[param];
      }
    });
    options.body = JSON.stringify(body);
  }

  // Make request
  const fullUrl = `${baseUrl}${url}`;

  try {
    const response = await fetch(fullUrl, options);

    // Try to parse response as JSON
    let responseData;
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      responseData = { rawText: text };
    }

    // Handle HTTP errors
    if (!response.ok) {
      const error = new Error(
        `API Error ${response.status}: ${responseData.message || response.statusText}`
      );
      error.status = response.status;
      error.response = responseData;
      throw error;
    }

    return responseData;
  } catch (error) {
    // Re-throw with more context
    if (error.status) {
      throw error; // Already formatted
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

/**
 * Extracts token from API response
 * @param {object} response - The API response
 * @param {string} tokenField - The field name containing the token
 * @returns {object|null} Token object or null
 */
export function extractToken(response, tokenField) {
  if (!tokenField || !response) {
    return null;
  }

  // Support nested field access (e.g., "data.token")
  const fields = tokenField.split(".");
  let value = response;

  for (const field of fields) {
    if (value && typeof value === "object") {
      value = value[field];
    } else {
      return null;
    }
  }

  return value || null;
}

/**
 * Saves request to history in localStorage
 * @param {string} role - Role name (student, assessor, manager, presence)
 * @param {string} endpointName - Endpoint name
 * @param {object} params - Request parameters
 */
export function saveRequestHistory(role, endpointName, params) {
  try {
    const key = `requestHistory_${role}`;
    const history = JSON.parse(localStorage.getItem(key) || "[]");

    // Remove if already exists (keep unique)
    const filtered = history.filter(item =>
      !(item.endpointName === endpointName &&
        JSON.stringify(item.params) === JSON.stringify(params))
    );

    // Add new request to the beginning
    filtered.unshift({
      endpointName,
      params,
      timestamp: new Date().toISOString()
    });

    // Keep only last 10
    filtered.splice(10);

    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (e) {
    console.error("Failed to save request history:", e);
  }
}

/**
 * Gets request history from localStorage
 * @param {string} role - Role name
 * @returns {array} Array of previous requests
 */
export function getRequestHistory(role) {
  try {
    const key = `requestHistory_${role}`;
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch (e) {
    console.error("Failed to get request history:", e);
    return [];
  }
}

/**
 * Clears request history
 * @param {string} role - Role name (or "all" to clear all)
 */
export function clearRequestHistory(role) {
  try {
    if (role === "all") {
      const roles = ["student", "assessor", "manager", "presence"];
      roles.forEach(r => {
        localStorage.removeItem(`requestHistory_${r}`);
      });
    } else {
      localStorage.removeItem(`requestHistory_${role}`);
    }
  } catch (e) {
    console.error("Failed to clear request history:", e);
  }
}

/**
 * Formats an API error for display
 * @param {Error} error
 * @returns {string} Formatted error message
 */
export function formatApiError(error) {
  if (!error) return "Unknown error";

  if (error.status === 401) {
    return "Unauthorized - Check your authentication token";
  }
  if (error.status === 403) {
    return "Forbidden - You don't have permission";
  }
  if (error.status === 404) {
    return "Not found - Check the parameters";
  }
  if (error.status >= 500) {
    return `Server error (${error.status})`;
  }
  if (error.message.includes("failed to fetch")) {
    return "Network error - Check API URL and connection";
  }

  return error.message || "Unknown error";
}
