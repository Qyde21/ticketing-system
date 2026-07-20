"use client";

import { useState } from "react";

export default function CheckoutForm({ event }: { event: any }) {
  const ticketTypes = event.ticketTypes || [];
  const [selectedTierId, setSelectedTierId] = useState(ticketTypes[0]?.id || "default");
  const [quantity, setQuantity] = useState(1);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedTier = ticketTypes.find((t: any) => t.id === selectedTierId) || ticketTypes[0];
  const unitPrice = Number(selectedTier?.price || 0);
  const total = unitPrice * quantity;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event.id,
          ticketTypeId: selectedTier.id !== "default" ? selectedTier.id : null,
          quantity,
          buyerName,
          buyerEmail,
          buyerPhone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize checkout");

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error("No authorization URL returned");
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCheckout} className="space-y-6 text-white">
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {ticketTypes.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Select Ticket Type</label>
          <select
            value={selectedTierId}
            onChange={(e) => setSelectedTierId(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          >
            {ticketTypes.map((tier: any) => (
              <option key={tier.id} value={tier.id} className="bg-gray-900 text-white">
                {tier.name} - KES {Number(tier.price || 0)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Ticket Quantity</label>
        <select
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
            <option key={num} value={num} className="bg-gray-900 text-white">
              {num} {num === 1 ? "Ticket" : "Tickets"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
        <input
          type="text"
          required
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
          placeholder="John Doe"
          className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
        <input
          type="email"
          required
          value={buyerEmail}
          onChange={(e) => setBuyerEmail(e.target.value)}
          placeholder="john@example.com"
          className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Phone Number</label>
        <input
          type="tel"
          required
          value={buyerPhone}
          onChange={(e) => setBuyerPhone(e.target.value)}
          placeholder="0712345678"
          className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-gray-900 p-4 rounded-md flex justify-between items-center border border-gray-800">
        <span className="font-semibold text-gray-300">Total Amount:</span>
        <span className="text-2xl font-bold text-blue-400">KES {total}</span>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? "Processing..." : "Proceed to Paystack"}
      </button>
    </form>
  );
}