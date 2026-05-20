const multer = require("multer")


const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: function (req, file, cb) {
        const allowed = [ 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword' ]
        if (allowed.includes(file.mimetype) || /\.docx?$/.test((file.originalname || '').toLowerCase())) {
            cb(null, true)
        } else {
            cb(new Error('Unsupported file type. Please upload PDF or DOC/DOCX.'))
        }
    }
})


module.exports = upload