const WebhookEventsModel = require("../models/webhook_events.model");

const WebhookEventsController = {
  async create(req, res) {
    try {
      const { event_id, event_type, app_user_id, payload_json, processed_at } =
        req.body;

      if (!event_id || !event_type || !payload_json) {
        return res.status(400).json({
          success: false,
          message: "event_id, event_type, payload_json are required",
        });
      }

      const existingEvent = await WebhookEventsModel.findByEventId(event_id);

      if (existingEvent) {
        return res.status(409).json({
          success: false,
          message: "Webhook event already exists",
          data: existingEvent,
        });
      }

      const webhookEvent = await WebhookEventsModel.create({
        event_id,
        event_type,
        app_user_id,
        payload_json,
        processed_at,
      });

      return res.status(201).json({
        success: true,
        data: webhookEvent,
      });
    } catch (error) {
      console.error("Create webhook event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create webhook event",
        error: error.message,
      });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;

      const webhookEvent = await WebhookEventsModel.findById(id);

      if (!webhookEvent) {
        return res.status(404).json({
          success: false,
          message: "Webhook event not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: webhookEvent,
      });
    } catch (error) {
      console.error("Get webhook event by id error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch webhook event",
        error: error.message,
      });
    }
  },

  async getByEventId(req, res) {
    try {
      const { eventId } = req.params;

      const webhookEvent = await WebhookEventsModel.findByEventId(eventId);

      if (!webhookEvent) {
        return res.status(404).json({
          success: false,
          message: "Webhook event not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: webhookEvent,
      });
    } catch (error) {
      console.error("Get webhook event by event id error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch webhook event",
        error: error.message,
      });
    }
  },

  async getAll(req, res) {
    try {
      const limit = Number(req.query.limit) || 50;

      const webhookEvents = await WebhookEventsModel.findAll(limit);

      return res.status(200).json({
        success: true,
        data: webhookEvents,
      });
    } catch (error) {
      console.error("Get all webhook events error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch webhook events",
        error: error.message,
      });
    }
  },

  async markProcessed(req, res) {
    try {
      const { eventId } = req.params;

      const updatedEvent = await WebhookEventsModel.markProcessed(eventId);

      if (!updatedEvent) {
        return res.status(404).json({
          success: false,
          message: "Webhook event not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Webhook event marked as processed",
        data: updatedEvent,
      });
    } catch (error) {
      console.error("Mark webhook event processed error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update webhook event",
        error: error.message,
      });
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;

      const deletedEvent = await WebhookEventsModel.deleteById(id);

      if (!deletedEvent) {
        return res.status(404).json({
          success: false,
          message: "Webhook event not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Webhook event deleted successfully",
        data: deletedEvent,
      });
    } catch (error) {
      console.error("Delete webhook event error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete webhook event",
        error: error.message,
      });
    }
  },
};

module.exports = WebhookEventsController;
