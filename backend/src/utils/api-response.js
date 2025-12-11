/**
 * Standardized API response utility
 * Ensures consistent response format across the application
 */
class ApiResponse {
  // ============ CORE SUCCESS METHODS ============
  static success(res, data = null, message = 'Success', statusCode = 200) {
    const response = {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };

    // Remove data field if null
    if (data === null) {
      delete response.data;
    }

    return res.status(statusCode).json(response);
  }

  // Created resouces
  static created(res, data, message = 'Resource created successfully') {
    return this.success(res, data, message, 201);
  }

  // No content operation
  static noContent(res, message = 'Operation successful') {
    return res.status(204).json({
      success: true,
      message,
      timestamp: new Date().toISOString(),
    });

    // 204 No Content must have empty body according to HTTP spec. but for dev. we send res.
    // return res.status(204).send();
  }

  // For Delete Operation
  static deleted(res, message = 'Resource deleted successfully') {
    return res.status(200).json({
      success: true,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  // ============ SPECIALIZED SUCCESS RESPONSES ============
  static paginated(res, data, pagination, message = 'Success') {
    // Validation for pagination object
    if (!pagination || !pagination.page || !pagination.limit || pagination.total === undefined) {
      throw new Error('Invalid pagination object. Must include page, limit, and total.');
    }

    const totalPages = Math.ceil(pagination.total / pagination.limit);

    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: parseInt(pagination.page),
        limit: parseInt(pagination.limit),
        total: parseInt(pagination.total),
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
        count: Array.isArray(data) ? data.length : 0, // Current page item count
        startIndex: (pagination.page - 1) * pagination.limit + 1,
        endIndex: Math.min(pagination.page * pagination.limit, pagination.total),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // For bulk operations
  static bulk(res, data, summary, message = 'Bulk operation completed') {
    return res.status(200).json({
      success: true,
      message,
      data,
      summary: {
        total: summary.total || 0,
        successful: summary.successful || 0,
        failed: summary.failed || 0,
        errors: summary.errors || [],
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Your existing upload method
  static upload(res, data, message = 'Media uploaded successfully') {
    const mediaArray = data.media || [data];

    const files = mediaArray.map((media) => ({
      id: media._id,
      url: media.cloudinary?.urls?.original,
      type: media.type,
      size: media.size,
      originalName: media.originalName,
      altText: media.altText,
      status: media.status,
    }));

    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString(),
    };

    if (files.length === 1) {
      response.file = files[0];
    } else {
      response.files = files;
      if (data.summary) {
        response.summary = {
          total: data.summary.total,
          successful: data.summary.successful,
          failed: data.summary.failed,
        };
      }
    }

    return res.status(201).json(response);
  }

  // For search results
  static search(res, data, query, totalResults, message = 'Search completed') {
    return res.status(200).json({
      success: true,
      message,
      query,
      results: data,
      totalResults,
      count: Array.isArray(data) ? data.length : 0,
      timestamp: new Date().toISOString(),
    });
  }

  // ============ INTERNAL ERROR METHOD (Only for errorHandler) ============
  /**
   * Internal method used only by errorHandler middleware
   * Controllers should NOT use this - use ApiError instead
   */
  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
    };

    // Add errors field only if provided
    if (errors) {
      response.errors = Array.isArray(errors) ? errors : [errors];
    }

    // Add stack trace in development - See where exactly in your code the error happened
    if (process.env.NODE_ENV === 'development') {
      if (errors instanceof Error) {
        response.stack = errors.stack;
      }
    }

    return res.status(statusCode).json(response);
  }
}

export default ApiResponse;

// ==================== Decision Flow ============================
/*
 * How to pick the right method -
 */

/*
1. Ask yourself: what type of operation is this?
  ✅ Read/Fetch data → use success or paginated or search
  ✅ Create new resource → use created
  ✅ Update existing resource → use success
  ✅ Delete resource → use deleted
  ✅ No content to return → use noContent
  ✅ Multiple items processed → use bulk
  ✅ File upload → use upload
  ✅ Search/Query → use search
2. Ask: Do I need extra metadata?
  Pagination info → paginated
  Bulk summary → bulk
  File info → upload
3. Ask: Did something fail?
  Never call ApiResponse.error directly in controllers.
  Instead, throw an AppError, and let the global error handler call ApiResponse.error.
*/
