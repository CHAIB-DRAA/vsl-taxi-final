const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const authMiddleware = require('../middleware/auth'); 

// Protection de toutes les routes groupes
router.use(authMiddleware);

// 1. RÉCUPÉRER MES GROUPES (GET /)
router.get('/', async (req, res) => {
  try {
    const myUserId = req.user.id || req.user.userId;
    // On cherche les groupes où je suis propriétaire OU membre
    const groups = await Group.find({
        $or: [
            { ownerId: myUserId },
            { members: myUserId }
        ]
    })
    .populate('members', 'fullName phone email') // On récupère les infos des membres
    .populate('ownerId', 'fullName');

    res.json(groups);
  } catch (err) {
    console.error("🔥 Erreur récupération groupes:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. CRÉER UN GROUPE (POST /)
router.post('/', async (req, res) => {
  try {
    const { name, members } = req.body;
    const myUserId = req.user.id || req.user.userId;

    if (!name) return res.status(400).json({ error: "Le nom est requis" });

    // On s'assure que le créateur est aussi dans la liste des membres (optionnel mais pratique)
    const allMembers = [...new Set([...members, myUserId])]; // Supprime les doublons

    const newGroup = new Group({
      name,
      ownerId: myUserId,
      members: allMembers
    });

    const savedGroup = await newGroup.save();
    
    // On peuple les données pour l'affichage direct
    await savedGroup.populate('members', 'fullName phone');
    
    res.status(201).json(savedGroup);
  } catch (err) {
    console.error("🔥 Erreur création groupe:", err);
    res.status(500).json({ error: err.message });
  }
});

// 👇 3. MODIFIER UN GROUPE (PUT /:id) - C'EST CELLE QUI TE MANQUAIT
router.put('/:id', async (req, res) => {
    try {
        const { name, members } = req.body;
        const groupId = req.params.id;
        const myUserId = req.user.id || req.user.userId;

        // 1. On vérifie si le groupe existe et si je suis le proprio
        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: "Groupe introuvable" });

        // Sécurité : Seul le propriétaire peut modifier (ou tu peux enlever cette ligne si tout le monde peut modifier)
        if (group.ownerId.toString() !== myUserId) {
            return res.status(403).json({ error: "Seul le créateur peut modifier ce groupe." });
        }

        // 2. Mise à jour
        // On s'assure de garder le proprio dans les membres
        const allMembers = [...new Set([...members, myUserId])];

        const updatedGroup = await Group.findByIdAndUpdate(
            groupId,
            { name, members: allMembers },
            { new: true } // Pour renvoyer la version modifiée
        ).populate('members', 'fullName phone');

        console.log(`✏️ Groupe ${groupId} modifié par ${myUserId}`);
        res.json(updatedGroup);

    } catch (err) {
        console.error("🔥 Erreur modification groupe:", err);
        res.status(500).json({ error: err.message });
    }
});

// 👇 4. SUPPRIMER UN GROUPE (DELETE /:id) - CELLE-CI AUSSI MANQUAIT
router.delete('/:id', async (req, res) => {
    try {
        const groupId = req.params.id;
        const myUserId = req.user.id || req.user.userId;

        const group = await Group.findById(groupId);
        if (!group) return res.status(404).json({ error: "Groupe introuvable" });

        if (group.ownerId.toString() !== myUserId) {
            return res.status(403).json({ error: "Seul le créateur peut supprimer ce groupe." });
        }

        await Group.findByIdAndDelete(groupId);
        console.log(`🗑️ Groupe ${groupId} supprimé.`);
        
        res.json({ message: "Groupe supprimé" });

    } catch (err) {
        console.error("🔥 Erreur suppression groupe:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;