import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Note, User } from '../types';
import { 
  Plus, Search, Pin, Trash2, Notebook, Loader2, 
  Save, ChevronLeft
} from 'lucide-react';

interface NotesProps {
  user: User;
}

const CATEGORIES = ['General', 'Ideas', 'Competitors', 'Customers', 'Goals', 'Personal'] as const;

const Notes: React.FC<NotesProps> = ({ user }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCategory, setEditCategory] = useState<string>('General');
  
  // Auto-save timer ref
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    fetchNotes();
  }, [user.id]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNoteToDb = async (id: string, title: string, body: string, category: string) => {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('notes')
        .update({ 
          title, 
          body, 
          category,
          updated_at: now 
        })
        .eq('id', id);

      if (error) throw error;

      // Update local list to reflect new timestamp/preview
      setNotes(prev => prev.map(n => 
        n.id === id 
          ? { ...n, title, body, category: category as Note['category'], updated_at: now } 
          : n
      ));
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectNote = (note: Note) => {
    // Force save previous if pending
    if (saveTimeoutRef.current && selectedNoteId) {
      clearTimeout(saveTimeoutRef.current);
      saveNoteToDb(selectedNoteId, editTitle, editBody, editCategory);
    }

    setSelectedNoteId(note.id);
    setEditTitle(note.title);
    setEditBody(note.body);
    setEditCategory(note.category);
  };

  const handleCreateNote = async () => {
    try {
      const now = new Date().toISOString();
      const newNote = {
        user_id: user.id,
        title: '',
        body: '',
        pinned: false,
        category: 'General',
        created_at: now,
        updated_at: now
      };

      const { data, error } = await supabase
        .from('notes')
        .insert([newNote])
        .select()
        .single();

      if (error) throw error;

      setNotes(prev => [data, ...prev]);
      handleSelectNote(data);
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setNotes(prev => prev.filter(n => n.id !== id));
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
        setEditTitle('');
        setEditBody('');
      }
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    const newPinnedState = !note.pinned;

    // Optimistic Update with correct sorting
    setNotes(prev => {
      const updated = prev.map(n => n.id === note.id ? { ...n, pinned: newPinnedState } : n);
      return updated.sort((a, b) => {
        return (Number(b.pinned) - Number(a.pinned)) ||
               (new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      });
    });

    try {
      await supabase
        .from('notes')
        .update({ pinned: newPinnedState })
        .eq('id', note.id);
    } catch (err) {
      console.error('Error pinning note:', err);
      fetchNotes(); // Revert on error
    }
  };

  const handleEditorChange = (
    field: 'title' | 'body' | 'category', 
    value: string
  ) => {
    if (!selectedNoteId) return;

    if (field === 'title') setEditTitle(value);
    if (field === 'body') setEditBody(value);
    if (field === 'category') setEditCategory(value);

    // Debounce save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
      saveNoteToDb(
        selectedNoteId, 
        field === 'title' ? value : editTitle, 
        field === 'body' ? value : editBody,
        field === 'category' ? value : editCategory
      );
    }, 3000); // 3 second auto-save
  };

  // Helper: Time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const filteredNotes = notes.filter(n => 
    (n.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (n.body?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const activeNote = notes.find(n => n.id === selectedNoteId) || null;

  return (
    <div className="h-full w-full flex bg-background text-text-main overflow-hidden">
      
      {/* Left Sidebar (List) */}
      <div className={`w-full md:w-80 lg:w-96 flex flex-col border-r border-white/5 bg-surface/50 ${selectedNoteId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Header */}
        <div className="p-4 border-b border-white/5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
              <Notebook className="text-gold" size={20} /> Notes
            </h2>
            <button 
              onClick={handleCreateNote}
              className="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors"
              title="New Note"
            >
              <Plus size={20} />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-text-main focus:outline-none focus:border-gold/50 transition-colors"
            />
          </div>
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-gold" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center p-8 text-text-muted opacity-60">
              <p className="text-sm">No notes found.</p>
              {searchQuery ? (
                <p className="text-xs mt-1">Try a different search.</p>
              ) : (
                <p className="text-xs mt-1">Create one to get started.</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredNotes.map(note => (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={`p-4 cursor-pointer transition-colors hover:bg-white/5 group ${
                    selectedNoteId === note.id
                      ? 'bg-white/5 border-l-2 border-gold'
                      : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3
                      className={`font-semibold text-sm truncate pr-2 ${
                        !note.title ? 'text-text-muted italic' : 'text-text-main'
                      }`}
                    >
                      {note.title || 'Untitled Note'}
                    </h3>
                    {note.pinned && <Pin size={12} className="text-gold shrink-0 fill-gold" />}
                  </div>
                  <p className="text-xs text-text-muted line-clamp-2 mb-2 h-8 leading-relaxed">
                    {note.body || 'No content...'}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-text-muted bg-background px-2 py-0.5 rounded border border-white/5">
                      {note.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-muted">
                        {formatTimeAgo(note.updated_at)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="p-1 rounded-full text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Editor (Detail) */}
      <div className={`flex-1 flex flex-col bg-background h-full ${!selectedNoteId ? 'hidden md:flex' : 'flex'}`}>
        {selectedNoteId && activeNote ? (
          <>
            {/* Editor Toolbar */}
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-surface/30 shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedNoteId(null)}
                  className="md:hidden p-2 -ml-2 text-text-muted hover:text-white"
                >
                  <ChevronLeft size={20} />
                </button>

                {/* Category tabs instead of dropdown */}
                <div className="flex gap-1 bg-background/40 rounded-full border border-white/5 px-1 py-1 overflow-x-auto">
                  {CATEGORIES.map(cat => {
                    const isActive = editCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => handleEditorChange('category', cat)}
                        className={`px-3 py-1 rounded-full text-[11px] uppercase tracking-wider font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-gold text-black'
                            : 'text-text-muted hover:bg-white/10'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                <span className="text-[10px] text-text-muted flex items-center gap-1">
                  {isSaving ? (
                    <>
                      <Loader2 size={10} className="animate-spin"/> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={10}/> Saved
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={(e) => {
                    if (activeNote) handleTogglePin(e, activeNote);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                    activeNote?.pinned
                      ? 'bg-gold/10 text-gold'
                      : 'text-text-muted hover:bg-white/5 hover:text-white'
                  }`}
                  title="Pin note"
                >
                  <Pin size={16} />
                  <span className="hidden md:inline">Pin</span>
                </button>
                <button 
                  onClick={() => handleDeleteNote(selectedNoteId)}
                  className="px-3 py-1 rounded-full text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-1"
                  title="Delete note"
                >
                  <Trash2 size={16} />
                  <span className="hidden md:inline">Delete</span>
                </button>
              </div>
            </div>

            {/* Editor Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => handleEditorChange('title', e.target.value)}
                placeholder="Note Title"
                className="w-full bg-transparent text-2xl md:text-3xl font-bold text-text-main placeholder-text-muted/30 focus:outline-none mb-6"
              />
              <textarea
                value={editBody}
                onChange={(e) => handleEditorChange('body', e.target.value)}
                placeholder="Start typing your thoughts..."
                className="w-full h-[calc(100%-4rem)] bg-transparent text-text-main text-base leading-relaxed resize-none focus:outline-none placeholder-text-muted/30 font-light"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted p-8 text-center opacity-60">
            <Notebook size={48} className="mb-4 text-white/20" />
            <h3 className="text-lg font-medium text-text-main mb-1">Select a note to view</h3>
            <p className="text-sm max-w-xs">
              Choose a note from the list on the left, or create a new one to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notes;
