"use client"; // Agar App Router use kar rahe hain to ye line zaroori hai

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ⚠️ Yahan apni keys dalein (ya .env file se uthayen)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [form, setForm] = useState({ username: '', comment: '', rating: 0 });
  const [loading, setLoading] = useState(false);
  const [hoverRating, setHoverRating] = useState(0); // Star hover effect ke liye

  // Page load hote hi purane reviews laye
  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false }); // Newest pehle

    if (!error) setReviews(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.rating === 0) return alert("Please select a star rating!");
    setLoading(true);

    const { error } = await supabase
      .from('reviews')
      .insert([{ 
        username: form.username, 
        rating: form.rating, 
        comment: form.comment 
      }]);

    setLoading(false);

    if (error) {
      alert("Error saving review!");
    } else {
      setForm({ username: '', comment: '', rating: 0 }); // Form clear karein
      fetchReviews(); // List update karein
      alert("Thanks for your review!");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center">
      
      {/* --- Review Form --- */}
      <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md mb-8">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Leave a Review</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Your Name</label>
            <input
              type="text"
              required
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="text-3xl focus:outline-none transition-colors duration-200"
                  onClick={() => setForm({ ...form, rating: star })}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{ color: star <= (hoverRating || form.rating) ? '#FFD700' : '#E5E7EB' }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Comment Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Comment</label>
            <textarea
              required
              rows="3"
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
            ></textarea>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      </div>

      {/* --- Display Reviews --- */}
      <div className="w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-gray-700">Recent Reviews ({reviews.length})</h3>
        
        {reviews.length === 0 ? (
          <p className="text-gray-500 text-center">No reviews yet. Be the first!</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-gray-800">{review.username}</span>
                  <span className="text-yellow-500 text-lg">
                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                  </span>
                </div>
                <p className="text-gray-600">{review.comment}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
    }
