const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).min(3).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).min(3).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).min(1).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).min(3).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

function parseMaybeJson(value) {
    if (typeof value !== 'string') {
        return value
    }

    const trimmed = value.trim()
    if (!trimmed) {
        return value
    }

    const unquoted = trimmed.replace(/^`+|`+$/g, '').trim()
    const tryParse = (text) => {
        try {
            return JSON.parse(text)
        } catch {
            return null
        }
    }

    let parsed = tryParse(unquoted)
    if (parsed !== null) {
        return parsed
    }

    if ((unquoted.startsWith('"') && unquoted.endsWith('"')) || (unquoted.startsWith("'") && unquoted.endsWith("'"))) {
        parsed = tryParse(unquoted.slice(1, -1))
        if (parsed !== null) {
            return parsed
        }
    }

    parsed = tryParse(unquoted.replace(/\\"/g, '"').replace(/\\'/g, "'"))
    if (parsed !== null) {
        return parsed
    }

    return value
}

function normalizeQuestions(items) {
    if (!Array.isArray(items)) {
        return []
    }

    return items.map((item) => {
        const parsed = parseMaybeJson(item) || {}
        return {
            question: String(parsed.question || parsed.prompt || parsed.text || ''),
            intention: String(parsed.intention || parsed.reason || ''),
            answer: String(parsed.answer || parsed.modelAnswer || parsed.response || '')
        }
    })
}

function normalizeSkillGaps(items) {
    if (!Array.isArray(items)) {
        return []
    }

    return items.map((item) => {
        const parsed = parseMaybeJson(item) || {}
        const severity = String(parsed.severity || parsed.level || '').toLowerCase()
        return {
            skill: String(parsed.skill || parsed.focus || ''),
            severity: ['low', 'medium', 'high'].includes(severity) ? severity : 'medium'
        }
    })
}

function normalizePreparationPlan(items) {
    if (!Array.isArray(items)) {
        return []
    }

    return items.map((item, index) => {
        const parsed = parseMaybeJson(item) || {}
        const rawTasks = parsed.tasks
        let tasks = []

        if (Array.isArray(rawTasks)) {
            tasks = rawTasks.map(String)
        } else if (typeof rawTasks === 'string') {
            tasks = rawTasks
                .split(/\r?\n|;|•|‣|◦|-/)
                .map((task) => task.trim())
                .filter(Boolean)
        }

        const parsedDay = Number(parsed.day)
        const day = Number.isFinite(parsedDay) && parsedDay > 0 ? parsedDay : index + 1

        return {
            day,
            focus: String(parsed.focus || parsed.title || ''),
            tasks
        }
    })
}

function normalizeInterviewReport(report, jobDescription) {
    const parsed = report || {}
    return {
        title: String(parsed.title || jobDescription || 'Interview Report'),
        matchScore: Number(parsed.matchScore ?? 0),
        technicalQuestions: normalizeQuestions(parsed.technicalQuestions),
        behavioralQuestions: normalizeQuestions(parsed.behavioralQuestions),
        skillGaps: normalizeSkillGaps(parsed.skillGaps),
        preparationPlan: normalizePreparationPlan(parsed.preparationPlan)
    }
}

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `Generate a detailed interview report for a candidate using the following information.\n\nResume: ${resume}\nSelf Description: ${selfDescription}\nJob Description: ${jobDescription}\n\nReturn a valid JSON object with these fields exactly: title, matchScore, technicalQuestions, behavioralQuestions, skillGaps, preparationPlan.\n- technicalQuestions must be an array of at least 3 objects, each with keys question, intention, and answer. Do not serialize objects as strings.\n- behavioralQuestions must be an array of at least 3 objects, each with keys question, intention, and answer.\n- skillGaps must be an array of at least 1 object, each with keys skill and severity (low, medium, high).\n- preparationPlan must be an array of at least 3 objects, each with keys day, focus, and tasks (tasks must be an array of strings).\n\nUse the resume and self description to personalize the report and make the content practical, specific, and role-focused.\n`

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json"
        }
    })

    const raw = JSON.parse(response.text)
    return normalizeInterviewReport(raw, jobDescription)
}

async function generatePdfFromHtml(htmlContent) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4", margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()

    return pdfBuffer
}

function extractSectionLines(text, sectionTitle) {
    if (!text || !sectionTitle) return []
    const regex = new RegExp(`${sectionTitle}\\s*[:\\n]+([\\s\\S]*?)(?:\\n\\s*\\n|$)`, 'i')
    const match = regex.exec(text)
    if (!match || !match[1]) return []
    return match[1]
        .split(/\\r?\\n|;|•|‣|◦|-/)
        .map((line) => line.trim())
        .filter(Boolean)
}

function createProfileSummary({ resume, selfDescription, jobDescription }) {
    const cleanResume = resume && !/uploaded resume .* could not be parsed/i.test(resume.toLowerCase()) ? resume.trim() : ''
    if (cleanResume) {
        return cleanResume
    }
    if (selfDescription && selfDescription.trim()) {
        return selfDescription.trim()
    }
    if (jobDescription && jobDescription.trim()) {
        const titleMatch = jobDescription.match(/Job Title\s*[:\-]?\s*(.+)/i)
        const title = titleMatch ? titleMatch[1].trim() : 'the role'
        return `Experienced and motivated candidate applying for ${title}, with strong skills relevant to the role described below.`
    }
    return 'Candidate resume details not provided.'
}

function createFallbackResumeHtml({ resume, selfDescription, jobDescription }) {
    const profileText = createProfileSummary({ resume, selfDescription, jobDescription })
    const skills = extractSectionLines(jobDescription, 'Required Skills')
    const responsibilities = extractSectionLines(jobDescription, 'Responsibilities')
    const qualifications = extractSectionLines(jobDescription, 'Preferred Qualifications')
    const summarySafe = profileText
        .split(/\r?\n/)
        .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
        .join('')

    const listToHtml = (items) => {
        if (!items || items.length === 0) return ''
        return `<ul>${items.map((item) => `<li>${item.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`).join('')}</ul>`
    }

    return `
        <html>
            <head>
                <meta charset="utf-8" />
                <title>Generated Resume</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
                    h1 { font-size: 28px; margin-bottom: 4px; }
                    h2 { font-size: 18px; margin: 22px 0 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
                    p, li { line-height: 1.5; margin: 8px 0; }
                    ul { margin: 8px 0 16px 20px; }
                    .section { margin-bottom: 16px; }
                    .subtle { color: #6b7280; font-size: 14px; }
                </style>
            </head>
            <body>
                <h1>Resume</h1>
                <p class="subtle">Tailored for: ${jobDescription ? jobDescription.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Job description not provided'}</p>
                <div class="section">
                    <h2>Professional Summary</h2>
                    ${summarySafe}
                </div>
                ${skills.length ? `<div class="section"><h2>Key Skills</h2>${listToHtml(skills)}</div>` : ''}
                ${responsibilities.length ? `<div class="section"><h2>Responsibilities</h2>${listToHtml(responsibilities)}</div>` : ''}
                ${qualifications.length ? `<div class="section"><h2>Qualifications</h2>${listToHtml(qualifications)}</div>` : ''}
            </body>
        </html>
    `
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(resumePdfSchema),
            }
        })

        const jsonContent = JSON.parse(response.text)

        if (jsonContent && typeof jsonContent.html === 'string' && jsonContent.html.trim()) {
            return await generatePdfFromHtml(jsonContent.html)
        }
    } catch (error) {
        console.error('AI resume PDF generation failed, using fallback HTML:', error.message || error)
    }

    const fallbackHtml = createFallbackResumeHtml({ resume, selfDescription, jobDescription })
    return await generatePdfFromHtml(fallbackHtml)

}

module.exports = { generateInterviewReport, generateResumePdf }