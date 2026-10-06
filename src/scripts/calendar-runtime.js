// 所有日曆共用一次資料請求，月份及選取狀態仍各自獨立。
let calendarData;
function loadCalendarData() {
  return calendarData ??= fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/calendar-data.json`)
    .then(response => { if (!response.ok) throw new Error(`Calendar HTTP ${response.status}`); return response.json(); })
    .catch(error => { calendarData = undefined; throw error; });
}
class ArticleCalendar extends HTMLElement {
  connectedCallback() {
    if (this.initialized) { document.addEventListener("pointerdown", this.outside); return; }
    this.initialized = true;
    const root = this;
    const monthNames = JSON.parse(this.dataset.months);
    const yearSuffix = this.dataset.yearSuffix;

	let allPostsData = [];
	const postDateMap = {};
	const postsByMonth = {};
	const stats = {
		hasPostInYear: {},
		hasPostInMonth: {},
		minYear: new Date().getFullYear(),
		maxYear: new Date().getFullYear() + 5,
	};

	async function fetchCalendarData() {
		try {
			const data = await loadCalendarData();
			if (Array.isArray(data)) {
				allPostsData = data;
				processPostsData(allPostsData);
				const currentPostId = getCurrentPostId();
				if (currentPostId) {
					const matchedPost = allPostsData.find(
						(p) => p.id === currentPostId,
					);
					if (matchedPost) {
						const [y, m] = matchedPost.date.split("-");
						currentYear = parseInt(y);
						currentMonth = parseInt(m) - 1;
					}
				}
				renderCalendar();
			}
		} catch (error) {
			console.error("Failed to fetch calendar data:", error);
		}
	}

	function processPostsData(posts) {
		if (!posts || posts.length === 0) return;
		posts.forEach((post) => {
			const [yStr, mStr] = post.date.split("-");
			const year = parseInt(yStr);
			const month = parseInt(mStr); // 1-12
			stats.hasPostInYear[year] = true;
			stats.hasPostInMonth[`${year}-${month}`] = true;

			if (year < stats.minYear) stats.minYear = year;

			const dateKey = post.date;
			const monthKey = `${year}-${month - 1}`; // JS Month is 0-11

			if (!postDateMap[dateKey]) postDateMap[dateKey] = [];
			postDateMap[dateKey].push(post);

			if (!postsByMonth[monthKey]) postsByMonth[monthKey] = [];
			postsByMonth[monthKey].push(post);
		});
	}

	const now = new Date();
	const todayYear = now.getFullYear();
	const todayMonth = now.getMonth();
	const todayDate = now.getDate();

	let currentYear = todayYear;
	let currentMonth = todayMonth;
	let selectedDateKey = null;
	let currentView = "day";

	const dom = {
		titleContainer: root.querySelector('[data-calendar="calendar-title-container"]'),
		title: root.querySelector('[data-calendar="calendar-title"]'),
		prevBtn: root.querySelector('[data-calendar="prev-month-btn"]'),
		nextBtn: root.querySelector('[data-calendar="next-month-btn"]'),
		backTodayBtn: root.querySelector('[data-calendar="back-to-today-btn"]'),
		calendarView: root.querySelector('[data-calendar="calendar-view"]'),
		selectionPanel: root.querySelector('[data-calendar="selection-panel"]'),
		selectionContent: root.querySelector('[data-calendar="selection-content"]'),
		grid: root.querySelector('[data-calendar="calendar-grid"]'),
		postsList: root.querySelector('[data-calendar="calendar-posts-list"]'),
		divider: root.querySelector('[data-calendar="calendar-posts-divider"]'),
	};

	function getCurrentPostId() {
		const path = window.location.pathname;
		if (!allPostsData || allPostsData.length === 0) return null;
		const decodedPath = decodeURIComponent(path);
		const normalizedPath = decodedPath.endsWith("/")
			? decodedPath.slice(0, -1)
			: decodedPath;

		const matchedPost = allPostsData.find((post) => {
			return normalizedPath.endsWith(`/${post.id}`);
		});
		return matchedPost ? matchedPost.id : null;
	}

	function init() {
		renderCalendar();
		setupEventListeners();
		fetchCalendarData();
	}

	function setupEventListeners() {
		dom.titleContainer.addEventListener("click", (e) => {
			e.stopPropagation();
			if (currentView === "day") showMonthPicker();
			else if (currentView === "month") showYearPicker();
			else closeSelectionPanel();
		});

		dom.prevBtn.addEventListener("click", () => {
			currentMonth--;
			if (currentMonth < 0) {
				currentMonth = 11;
				currentYear--;
			}
			renderCalendar();
		});

		dom.nextBtn.addEventListener("click", () => {
			currentMonth++;
			if (currentMonth > 11) {
				currentMonth = 0;
				currentYear++;
			}
			renderCalendar();
		});

		dom.backTodayBtn.addEventListener("click", () => {
			currentYear = todayYear;
			currentMonth = todayMonth;
			selectedDateKey = null;
			if (currentView !== "day") closeSelectionPanel();
			else renderCalendar();
		});

		dom.grid.addEventListener("click", (e) => {
			const cell = e.target.closest(".calendar-day");
			if (!cell) return;
			const dateKey = cell.getAttribute("data-date");

			if (selectedDateKey === dateKey) selectedDateKey = null;
			else selectedDateKey = dateKey;

			renderCalendar();
			if (selectedDateKey && postDateMap[selectedDateKey]) {
				renderPostList(postDateMap[selectedDateKey]);
			} else {
				showMonthlyPosts();
			}
		});

		dom.selectionContent.addEventListener("click", (e) => {
			const monthItem = e.target.closest(".month-item");
			const yearItem = e.target.closest(".year-item");

			if (monthItem) {
				e.stopPropagation();
				currentMonth = parseInt(monthItem.getAttribute("data-month"));
				closeSelectionPanel();
			} else if (yearItem) {
				e.stopPropagation();
				currentYear = parseInt(yearItem.getAttribute("data-year"));
				showMonthPicker();
			}
		});

		root.addEventListener("focusout", (e) => {
			if (currentView === "day") return;
			const widget = root;
			if (widget && !widget.contains(e.relatedTarget)) {
				closeSelectionPanel();
			}
		});
	}

	function updateHeader() {
		dom.title.textContent = `${currentYear}${yearSuffix} ${monthNames[currentMonth]}`;
		const isCurrentRealMonth =
			currentYear === todayYear && currentMonth === todayMonth;
		const shouldShowReset = !isCurrentRealMonth || selectedDateKey !== null;

		if (shouldShowReset) dom.backTodayBtn.classList.remove("invisible");
		else dom.backTodayBtn.classList.add("invisible");

		const isDayView = currentView === "day";
		dom.prevBtn.style.visibility = isDayView ? "visible" : "hidden";
		dom.nextBtn.style.visibility = isDayView ? "visible" : "hidden";
	}

	function renderCalendar() {
		updateHeader();
		const firstDayOfMonth =
			(new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
		const daysInMonth = new Date(
			currentYear,
			currentMonth + 1,
			0,
		).getDate();

		let html = "";
		if (firstDayOfMonth > 0) {
			html += `<div class="aspect-square"></div>`.repeat(firstDayOfMonth);
		}

		for (let day = 1; day <= daysInMonth; day++) {
			const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
			const posts = postDateMap[dateKey] || [];
			const hasPost = posts.length > 0;
			const count = posts.length;
			const isToday =
				currentYear === todayYear &&
				currentMonth === todayMonth &&
				day === todayDate;
			const isSelected = selectedDateKey === dateKey;

			let bgClass =
				"hover:bg-[var(--btn-plain-bg-hover)] text-neutral-700 dark:text-neutral-300 border border-transparent";

			if (isSelected) {
				bgClass =
					"bg-[var(--primary)] text-white shadow-md border border-transparent";
			} else if (isToday) {
				bgClass =
					"text-[var(--primary)] font-bold bg-[var(--primary)]/10 border border-[var(--primary)]";
			} else if (hasPost) {
				bgClass =
					"font-bold text-neutral-900 dark:text-neutral-100 hover:bg-[var(--btn-plain-bg-hover)] border border-transparent";
			}

			html += `
                <div class="calendar-day aspect-square flex items-center justify-center rounded-md cursor-pointer relative transition-all duration-200 ${bgClass}"
                    data-date="${dateKey}">
                    ${day}
                    ${hasPost && !isSelected ? `<span class="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--primary)]"></span>` : ""}
                    ${hasPost && count > 1 ? `<span class="absolute top-0.5 right-0.5 text-[9px] opacity-70 scale-75">${count}</span>` : ""}
                </div>
            `;
		}

		dom.grid.innerHTML = html;
		if (selectedDateKey && postDateMap[selectedDateKey]) {
			renderPostList(postDateMap[selectedDateKey]);
		} else {
			showMonthlyPosts();
		}
	}

	function showMonthlyPosts() {
		const key = `${currentYear}-${currentMonth}`; // Month is 0-11
		const posts = postsByMonth[key] || [];
		renderPostList(posts);
	}

	function renderPostList(posts) {
		if (!dom.postsList) return;
		if (posts.length === 0) {
			dom.divider.classList.add("hidden");
			dom.postsList.innerHTML = "";
			return;
		}

		dom.divider.classList.remove("hidden");
		const currentPostId = getCurrentPostId();

		const listHtml = posts
			.map((post) => {
				const [, m, d] = post.date.split("-");
				const dateStr = `${parseInt(m)}-${parseInt(d)}`;

				const isCurrentPost = post.id === currentPostId;
				let containerClass =
					"flex items-center justify-between text-sm transition-colors px-2 py-2 rounded-lg group border border-transparent";
				const titleClass = "truncate flex-1 font-bold transition-colors";
				let dateClass =
					"text-xs ml-2 whitespace-nowrap transition-colors";

				if (isCurrentPost) {
					containerClass +=
						" bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/10";
					dateClass += " text-[var(--primary)]/80";
				} else {
					containerClass +=
						" text-neutral-700 dark:text-neutral-300 hover:text-[var(--primary)] dark:hover:text-[var(--primary)] hover:bg-[var(--btn-plain-bg-hover)]";
					dateClass +=
						" text-neutral-400 group-hover:text-[var(--primary)]/70";
				}

				return `
            <a href="/posts/${post.id}/" class="${containerClass}">
                <span class="${titleClass}">${post.title}</span>
                <span class="${dateClass}">${dateStr}</span>
            </a>
        `;
			})
			.join("");

		dom.postsList.innerHTML = listHtml;
	}

	function showMonthPicker() {
		currentView = "month";
		updateHeader();
		dom.selectionPanel.classList.remove("hidden");
		requestAnimationFrame(() => {
			dom.selectionPanel.classList.remove("opacity-0");
		});

		dom.selectionContent.className =
			"w-full h-full p-4 grid grid-cols-3 gap-3 content-center";

		let html = "";
		monthNames.forEach((name, index) => {
			const isCurrentMonth = index === currentMonth;
			const hasPost = stats.hasPostInMonth[`${currentYear}-${index + 1}`];
			let cls =
				"month-item cursor-pointer rounded-lg flex flex-col items-center justify-center p-2 transition-all hover:bg-[var(--btn-plain-bg-hover)] relative border border-transparent";
			if (isCurrentMonth)
				cls +=
					" border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5";
			else cls += " text-neutral-700 dark:text-neutral-300";

			html += `
                <div class="${cls}" data-month="${index}">
                    <span class="text-sm font-bold">${name}</span>
                    ${hasPost ? `<span class="w-1 h-1 rounded-full bg-[var(--primary)] mt-1"></span>` : `<span class="w-1 h-1 mt-1"></span>`}
                </div>
             `;
		});
		dom.selectionContent.innerHTML = html;
	}

	function showYearPicker() {
		currentView = "year";
		updateHeader();
		dom.selectionContent.className =
			"w-full h-full p-2 grid grid-cols-4 gap-2 content-start overflow-y-auto";

		let html = "";
		for (let y = stats.minYear; y <= stats.maxYear; y++) {
			const isCurrent = y === currentYear;
			const hasPost = stats.hasPostInYear[y];
			let cls =
				"year-item cursor-pointer rounded-lg flex flex-col items-center justify-center py-3 transition-all hover:bg-[var(--btn-plain-bg-hover)] relative border border-transparent";
			if (isCurrent)
				cls +=
					" border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5";
			else cls += " text-neutral-700 dark:text-neutral-300";

			html += `
                <div class="${cls}" data-year="${y}">
                    <span class="text-sm font-bold">${y}</span>
                     ${hasPost ? `<span class="w-1.5 h-1.5 rounded-full bg-[var(--primary)] mt-1"></span>` : `<span class="w-1.5 h-1.5 mt-1"></span>`}
                </div>
            `;
		}
		dom.selectionContent.innerHTML = html;

		setTimeout(() => {
			const el = root.querySelector(`[data-year="${currentYear}"]`);
			if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
		}, 50);
	}

	function closeSelectionPanel() {
		dom.selectionPanel.classList.add("opacity-0");
		setTimeout(() => {
			dom.selectionPanel.classList.add("hidden");
			currentView = "day";
			renderCalendar();
		}, 200);
	}

    this.outside = (event) => {
      if (currentView !== "day" && !root.contains(event.target)) closeSelectionPanel();
    };
    document.addEventListener("pointerdown", this.outside);
	init();

  }
  disconnectedCallback() { document.removeEventListener("pointerdown", this.outside); }
}
if (!customElements.get("article-calendar")) customElements.define("article-calendar", ArticleCalendar);
