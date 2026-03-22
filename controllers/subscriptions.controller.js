const SubscriptionsModel = require("../models/subscriptions.model");

const SubscriptionsController = {
  async create(req, res) {
    try {
      const {
        user_id,
        provider,
        product_id,
        entitlement_id,
        status,
        will_renew,
        expires_at,
        latest_purchase_at,
        original_transaction_id,
        raw_customer_info_json,
      } = req.body;

      if (!user_id || !provider || !product_id || !status) {
        return res.status(400).json({
          success: false,
          message: "user_id, provider, product_id, status are required",
        });
      }

      const subscription = await SubscriptionsModel.create({
        user_id,
        provider,
        product_id,
        entitlement_id,
        status,
        will_renew,
        expires_at,
        latest_purchase_at,
        original_transaction_id,
        raw_customer_info_json,
      });

      return res.status(201).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      console.error("Create subscription error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create subscription",
        error: error.message,
      });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;

      const subscription = await SubscriptionsModel.findById(id);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      console.error("Get subscription by id error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch subscription",
        error: error.message,
      });
    }
  },

  async getByUserId(req, res) {
    try {
      const { userId } = req.params;

      const subscriptions = await SubscriptionsModel.findByUserId(userId);

      return res.status(200).json({
        success: true,
        data: subscriptions,
      });
    } catch (error) {
      console.error("Get subscriptions by user id error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch subscriptions",
        error: error.message,
      });
    }
  },

  async getActiveByUserId(req, res) {
    try {
      const { userId } = req.params;

      const subscription = await SubscriptionsModel.findActiveByUserId(userId);

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Active subscription not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      console.error("Get active subscription error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch active subscription",
        error: error.message,
      });
    }
  },

  async getByOriginalTransactionId(req, res) {
    try {
      const { originalTransactionId } = req.params;

      const subscription = await SubscriptionsModel.findByOriginalTransactionId(
        originalTransactionId,
      );

      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      console.error(
        "Get subscription by original transaction id error:",
        error,
      );
      return res.status(500).json({
        success: false,
        message: "Failed to fetch subscription",
        error: error.message,
      });
    }
  },

  async updateById(req, res) {
    try {
      const { id } = req.params;
      const data = req.body;

      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No data provided for update",
        });
      }

      const updatedSubscription = await SubscriptionsModel.updateById(id, data);

      if (!updatedSubscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: updatedSubscription,
      });
    } catch (error) {
      console.error("Update subscription by id error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update subscription",
        error: error.message,
      });
    }
  },

  async updateByOriginalTransactionId(req, res) {
    try {
      const { originalTransactionId } = req.params;
      const data = req.body;

      if (!data || Object.keys(data).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No data provided for update",
        });
      }

      const updatedSubscription =
        await SubscriptionsModel.updateByOriginalTransactionId(
          originalTransactionId,
          data,
        );

      if (!updatedSubscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: updatedSubscription,
      });
    } catch (error) {
      console.error(
        "Update subscription by original transaction id error:",
        error,
      );
      return res.status(500).json({
        success: false,
        message: "Failed to update subscription",
        error: error.message,
      });
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;

      const deletedSubscription = await SubscriptionsModel.deleteById(id);

      if (!deletedSubscription) {
        return res.status(404).json({
          success: false,
          message: "Subscription not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Subscription deleted successfully",
        data: deletedSubscription,
      });
    } catch (error) {
      console.error("Delete subscription error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete subscription",
        error: error.message,
      });
    }
  },
};

module.exports = SubscriptionsController;
