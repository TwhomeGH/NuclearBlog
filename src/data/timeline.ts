// Timeline data configuration file
// Used to manage data for the timeline page

export interface TimelineItem {
	id: string;
	title: string;
	description: string;
	type: "education" | "work" | "project" | "achievement";
	startDate: string;
	endDate?: string; // If empty, it means current
	location?: string;
	organization?: string;
	position?: string;
	skills?: string[];
	achievements?: string[];
	links?: {
		name: string;
		url: string;
		type: "website" | "certificate" | "project" | "other";
	}[];
	icon?: string; // Iconify icon name
	color?: string;
	featured?: boolean;
}

export const timelineData: TimelineItem[] = [
	{
		id: "TTWChatMessageServer",
		title: "TikTok & Twitch 聊天訊息處理服務器",
		description:
			"用於接收TikTok/Twitch聊天禮物訊息 在對接到像ReplyKit裡提供的自訂義子母窗口.",
		type: "project",
		startDate: "2025-12-21",
		skills: ["JavaScript", "Node.js", "TailwindCSS"],
		achievements: [],
		icon: "material-symbols:database",
		color: "#EA580C",
	},
	{
		id: "replykit_ios",
		title: "ReplyKit",
		description: "iPad/iPhone 適用的內建RTMP推流應用.",
		type: "project",
		startDate: "2025-11-03",
		skills: ["Swift", "JavaScript", "Metal", "Git"],
		achievements: [
			"實現使用iOS進行 RTMP推流",
			"實現自訂義子母聊天室窗口",
			"實現16:9 寬高輸出",
			"新增降噪/回音/自動增益設計",
			"App音量 麥克風音量 可控制",
			"基於Metal 高性能表現的 性能表現優於TikTok內建推流處理方式",
		],
		links: [
			{
				name: "GitHub Repository",
				url: "https://github.com/TwhomeGH/ReplyKit",
				type: "project",
			},
		],
		icon: "material-symbols:code",
		color: "#7C3AED",
		featured: true,
	},
	// {
	// 	id: "current-study",
	// 	title: "Studying Computer Science and Technology",
	// 	description:
	// 		"Currently studying Computer Science and Technology, focusing on web development and software engineering.",
	// 	type: "education",
	// 	startDate: "2022-09-01",
	// 	location: "Beijing",
	// 	organization: "Beijing Institute of Technology",
	// 	skills: ["Java", "Python", "JavaScript", "HTML/CSS", "MySQL"],
	// 	achievements: [
	// 		"Current GPA: 3.6/4.0",
	// 		"Completed data structures and algorithms course project",
	// 		"Participated in multiple course project developments",
	// 	],
	// 	icon: "material-symbols:school",
	// 	color: "#059669",
	// 	featured: true,
	// },
	// {
	// 	id: "web-development-course",
	// 	title: "Completed Web Development Online Course",
	// 	description:
	// 		"Completed a full-stack web development online course, systematically learning frontend and backend development technologies.",
	// 	type: "achievement",
	// 	startDate: "2024-01-15",
	// 	endDate: "2024-05-30",
	// 	organization: "Mooc Website",
	// 	skills: ["HTML", "CSS", "JavaScript", "Node.js", "Express"],
	// 	achievements: [
	// 		"Received course completion certificate",
	// 		"Completed 5 practical projects",
	// 		"Mastered full-stack development fundamentals",
	// 	],
	// 	links: [
	// 		{
	// 			name: "Course Certificate",
	// 			url: "https://certificates.example.com/web-dev",
	// 			type: "certificate",
	// 		},
	// 	],
	// 	icon: "material-symbols:verified",
	// 	color: "#059669",
	// },

	// {
	// 	id: "programming-contest",
	// 	title: "University Programming Contest",
	// 	description:
	// 		"Participated in a programming contest held by the university, improving algorithm and programming skills.",
	// 	type: "achievement",
	// 	startDate: "2023-10-20",
	// 	location: "Beijing Institute of Technology",
	// 	organization: "School of Computer Science",
	// 	skills: ["C++", "Algorithms", "Data Structures"],
	// 	achievements: [
	// 		"Won third prize in university contest",
	// 		"Improved algorithmic thinking ability",
	// 		"Strengthened programming fundamentals",
	// 	],
	// 	icon: "material-symbols:emoji-events",
	// 	color: "#7C3AED",
	// },
	// {
	// 	id: "part-time-tutor",
	// 	title: "Part-time Programming Tutor",
	// 	description:
	// 		"Provided programming tutoring for high school students, helping them learn Python basics.",
	// 	type: "work",
	// 	startDate: "2023-09-01",
	// 	endDate: "2024-01-31",
	// 	position: "Programming Tutor",
	// 	skills: ["Python", "Teaching", "Communication"],
	// 	achievements: [
	// 		"Helped 3 students master Python basics",
	// 		"Improved expression and communication skills",
	// 		"Gained teaching experience",
	// 	],
	// 	icon: "material-symbols:school",
	// 	color: "#059669",
	// },
	// {
	// 	id: "high-school-graduation",
	// 	title: "High School Graduation",
	// 	description:
	// 		"Graduated from high school with excellent grades and was admitted to the Computer Science and Technology program at Beijing Institute of Technology.",
	// 	type: "education",
	// 	startDate: "2019-09-01",
	// 	endDate: "2022-06-30",
	// 	location: "Jinan, Shandong",
	// 	organization: "No.1 High School of Jinan",
	// 	achievements: [
	// 		"College entrance exam score: 620",
	// 		"Received municipal model student award",
	// 		"Won provincial second prize in math competition",
	// 	],
	// 	icon: "material-symbols:school",
	// 	color: "#2563EB",
	// },
	// {
	// 	id: "first-programming-experience",
	// 	title: "First Programming Experience",
	// 	description:
	// 		"First encountered programming in high school IT class, started learning Python basic syntax.",
	// 	type: "education",
	// 	startDate: "2021-03-01",
	// 	skills: ["Python", "Basic Programming Concepts"],
	// 	achievements: [
	// 		'Completed first "Hello World" program',
	// 		"Learned basic loops and conditional statements",
	// 		"Developed interest in programming",
	// 	],
	// 	icon: "material-symbols:code",
	// 	color: "#7C3AED",
	// },
];

// Get timeline statistics
export const getTimelineStats = () => {
	const total = timelineData.length;
	const byType = {
		education: timelineData.filter((item) => item.type === "education")
			.length,
		work: timelineData.filter((item) => item.type === "work").length,
		project: timelineData.filter((item) => item.type === "project").length,
		achievement: timelineData.filter((item) => item.type === "achievement")
			.length,
	};

	return { total, byType };
};

// Get timeline items by type
export const getTimelineByType = (type?: string) => {
	if (!type || type === "all") {
		return timelineData.sort(
			(a, b) =>
				new Date(b.startDate).getTime() -
				new Date(a.startDate).getTime(),
		);
	}
	return timelineData
		.filter((item) => item.type === type)
		.sort(
			(a, b) =>
				new Date(b.startDate).getTime() -
				new Date(a.startDate).getTime(),
		);
};

// Get featured timeline items
export const getFeaturedTimeline = () => {
	return timelineData
		.filter((item) => item.featured)
		.sort(
			(a, b) =>
				new Date(b.startDate).getTime() -
				new Date(a.startDate).getTime(),
		);
};

// Get current ongoing items
export const getCurrentItems = () => {
	return timelineData.filter((item) => !item.endDate);
};

// Calculate total work experience
export const getTotalWorkExperience = () => {
	const workItems = timelineData.filter((item) => item.type === "work");
	let totalMonths = 0;

	workItems.forEach((item) => {
		const startDate = new Date(item.startDate);
		const endDate = item.endDate ? new Date(item.endDate) : new Date();
		const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
		const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
		totalMonths += diffMonths;
	});

	return {
		years: Math.floor(totalMonths / 12),
		months: totalMonths % 12,
	};
};
