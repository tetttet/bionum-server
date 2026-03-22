const express = require("express");
const router = express.Router();

const SubscriptionsController = require("../controllers/subscriptions.controller");

router.post("/", SubscriptionsController.create);

router.get("/user/:userId/active", SubscriptionsController.getActiveByUserId);
router.get("/user/:userId", SubscriptionsController.getByUserId);
router.get(
  "/transaction/:originalTransactionId",
  SubscriptionsController.getByOriginalTransactionId,
);
router.get("/:id", SubscriptionsController.getById);

router.patch(
  "/transaction/:originalTransactionId",
  SubscriptionsController.updateByOriginalTransactionId,
);
router.put("/:id", SubscriptionsController.updateById);

router.delete("/:id", SubscriptionsController.remove);

module.exports = router;
