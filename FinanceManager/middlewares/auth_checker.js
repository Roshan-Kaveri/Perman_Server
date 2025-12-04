function check_auth(req, res, next) {
  console.log("req to auth checker is recieved");
  next();
}

export default check_auth;
