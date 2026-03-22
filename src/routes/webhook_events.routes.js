const express = require("express");
const router = express.Router();

const WebhookEventsController = require("../controllers/webhook_events.controller");

router.post("/", WebhookEventsController.create);

router.get("/event/:eventId", WebhookEventsController.getByEventId);
router.get("/", WebhookEventsController.getAll);
router.get("/:id", WebhookEventsController.getById);

router.patch("/event/:eventId/process", WebhookEventsController.markProcessed);

router.delete("/:id", WebhookEventsController.remove);

module.exports = router;
