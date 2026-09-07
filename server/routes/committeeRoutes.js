const express = require("express");
const router = express.Router();
const { createCommittee, getCommitteesByOrganizer } = require("../controllers/committeeController");

router.post("/create", createCommittee);
router.get("/organizer/:organizerId", getCommitteesByOrganizer);

module.exports = router;