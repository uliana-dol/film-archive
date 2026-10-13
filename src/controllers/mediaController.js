const pool = require('../config/db');

exports.getAllMedia = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM media_tracker WHERE user_id = ? ORDER BY created_at DESC', [req.user.userId]);        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};

exports.addMedia = async (req, res) => {
    let { title, media_type, watch_status, season_vibe, rating, custom_poster, custom_url } = req.body;
    
    let genre = null, release_year = null, country = null, duration = null, plot = null, actors = null;
    let poster_url = custom_poster || custom_url || null;

    try {
        if (media_type === 'Movie' || media_type === 'Cartoon' || media_type === 'Anime Movie') {
            const omdbKey = process.env.OMDB_API_KEY; 
            const response = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&type=movie&apikey=${omdbKey}`);
            const data = await response.json();
            
            if (data.Response === "True") {
                genre = data.Genre !== "N/A" ? data.Genre : null;
                release_year = data.Year !== "N/A" ? data.Year : null;
                country = data.Country !== "N/A" ? data.Country : null;
                duration = data.Runtime !== "N/A" ? data.Runtime : null;
                plot = data.Plot !== "N/A" ? data.Plot : null;
                actors = data.Actors !== "N/A" ? data.Actors : null;
                title = data.Title !== "N/A" ? data.Title : title; 
                if (!poster_url && data.Poster !== "N/A") poster_url = data.Poster;
            }
        } else {
            const response = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}&embed=cast`);
            const info = await response.json();
            
            if (info && info.id) {
                genre = info.genres && info.genres.length > 0 ? info.genres.join(', ') : null;
                release_year = info.premiered ? info.premiered.substring(0, 4) : null;
                country = info.network && info.network.country ? info.network.country.name : (info.webChannel && info.webChannel.country ? info.webChannel.country.name : null);
                plot = info.summary ? info.summary.replace(/<[^>]*>?/gm, '') : null;
                duration = info.averageRuntime ? info.averageRuntime + ' min/ep' : null;
                title = info.name || title;
                
                if (info._embedded && info._embedded.cast && info._embedded.cast.length > 0) {
                    actors = info._embedded.cast.slice(0, 4).map(c => c.person.name).join(', ');
                }
                
                if (!poster_url && info.image && info.image.original) poster_url = info.image.original;
            }
        }
    } catch (err) {
        console.log("Internet search failed or no results");
    }

    try {
        const [result] = await pool.query(
            `INSERT INTO media_tracker (user_id, title, media_type, watch_status, season_vibe, rating, genre, release_year, country, duration, plot, actors, poster_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.userId, title, media_type, watch_status, season_vibe, rating || null, genre, release_year, country, duration, plot, actors, poster_url]
        );
        res.status(201).json({ message: 'Added!', id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add', details: error.message });
    }
};

exports.updateMedia = async (req, res) => {
    const { id } = req.params;
    const { title, watch_status, rating, genre, release_year, country, duration, plot, actors, season_vibe } = req.body;
    try {
        await pool.query(
            `UPDATE media_tracker SET title=?, watch_status=?, rating=?, genre=?, release_year=?, country=?, duration=?, plot=?, actors=?, season_vibe=? WHERE id=? AND user_id=?`,
            [title, watch_status, rating || null, genre, release_year, country, duration, plot, actors, season_vibe, id, req.user.userId]
        );
        res.json({ message: 'Updated!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update' });
    }
};

exports.deleteMedia = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM media_tracker WHERE id = ? AND user_id = ?', [id, req.user.userId]);
        res.json({ message: 'Deleted!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
};
