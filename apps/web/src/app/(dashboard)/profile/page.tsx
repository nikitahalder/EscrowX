'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Star, Edit2, Save, Loader2 } from 'lucide-react';
import { usersApi, reviewsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, shortenAddress } from '@/lib/utils';
import type { Review } from '@/types';

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);

  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      displayName: user?.displayName || '',
      bio: user?.bio || '',
    },
  });

  useEffect(() => {
    if (user?.id) {
      reviewsApi.getByUser(user.id).then((r: any) => setReviews(r));
    }
  }, [user?.id]);

  async function onSave(data: any) {
    setSaving(true);
    try {
      const updated = await usersApi.updateMe(data) as any;
      updateUser(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">My Profile</h1>

      {/* Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-2xl font-bold">
              {user?.displayName?.[0]?.toUpperCase() || user?.walletAddress?.[0]}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {user?.displayName || 'Anonymous'}
              </h2>
              <p className="text-slate-400 font-mono text-sm">{shortenAddress(user?.walletAddress || '', 10)}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs border border-blue-500/20 capitalize">
                  {user?.role?.toLowerCase()}
                </span>
                {avgRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm text-white">{avgRating.toFixed(1)}</span>
                    <span className="text-sm text-slate-400">({reviews.length})</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
        </div>

        {editing ? (
          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Display Name</label>
              <input
                {...register('displayName')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Bio</label>
              <textarea
                {...register('bio')}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          user?.bio && <p className="text-slate-300">{user.bio}</p>
        )}

        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-800">
          <div className="text-center">
            <p className="text-xl font-bold text-white">{user?.completedProjects ?? 0}</p>
            <p className="text-sm text-slate-400">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{avgRating > 0 ? avgRating.toFixed(1) : '-'}</p>
            <p className="text-sm text-slate-400">Avg Rating</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{reviews.length}</p>
            <p className="text-sm text-slate-400">Reviews</p>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4">Reviews Received</h3>
        {reviews.length === 0 ? (
          <p className="text-slate-400 text-sm">No reviews yet. Complete projects to receive reviews.</p>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm">
                      {review.reviewer?.displayName?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-sm font-medium text-white">
                      {review.reviewer?.displayName || shortenAddress(review.reviewer?.walletAddress || '')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}
                      />
                    ))}
                  </div>
                </div>
                {review.reviewText && (
                  <p className="text-slate-300 text-sm">{review.reviewText}</p>
                )}
                <p className="text-xs text-slate-500 mt-2">{formatDate(review.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
