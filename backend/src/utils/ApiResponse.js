class ApiResponse {
  constructor({ message = "Success", data = null, meta = null, success = true } = {}) {
    this.success = success;
    this.message = message;
    if (data !== null) this.data = data;
    if (meta !== null) this.meta = meta;
  }
}

export default ApiResponse;
