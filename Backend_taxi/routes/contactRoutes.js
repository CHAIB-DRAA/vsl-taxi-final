const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { addContact, getContacts, deleteContact, searchUsers } = require('../controllers/contactController');

router.use(authMiddleware); // Protection de toutes les routes

// 1. Rechercher (DOIT être déclaré avant /:id)
router.get('/search', searchUsers);

// 2. Ajouter et Lister
router.post('/', addContact);
router.get('/', getContacts);

// 3. Supprimer
router.delete('/:id', deleteContact);

module.exports = router;