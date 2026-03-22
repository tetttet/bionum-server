const app = require("./api/index");

const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀🚀🚀 Сервер работает на http://localhost:${PORT}`);
});