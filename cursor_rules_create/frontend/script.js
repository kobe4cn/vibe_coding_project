const qs = (sel, scope = document) => scope.querySelector(sel);
const qsa = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

// 导航
(() => {
  const toggle = qs("#nav-toggle");
  const links = qs("#nav-links");
  const cta = qs("#nav-cta");

  toggle?.addEventListener("click", () => {
    links?.classList.toggle("open");
  });

  cta?.addEventListener("click", () => {
    qs("#playground")?.scrollIntoView({ behavior: "smooth" });
  });
})();

// 特性 Tab
(() => {
  const nav = qs("#feature-nav");
  const tabs = qsa(".tab");
  const panes = qsa(".tab-pane");

  nav?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.dataset.tab) return;
    tabs.forEach((btn) => btn.classList.toggle("active", btn === target));
    panes.forEach((pane) =>
      pane.classList.toggle("active", pane.id === `tab-${target.dataset.tab}`)
    );
  });
})();

// 状态流转
(() => {
  const board = qs("#flow-board");
  const detailList = qs("#detail-list");
  const nodes = qsa(".flow-node");
  const flowRule = {
    open: ["in_progress", "cancelled"],
    in_progress: ["open", "completed", "cancelled"],
    completed: ["open"],
    cancelled: ["open"],
  };
  const descriptions = {
    open: "待处理：等待领取或开始。",
    in_progress: "处理中：推动进展，可随时回到 open。",
    completed: "已完成：需要填写处理结果，可 reopen。",
    cancelled: "已取消：允许重新打开。",
  };

  const renderDetail = (status) => {
    if (!detailList) return;
    detailList.innerHTML = "";
    const next = flowRule[status] || [];
    const fragment = document.createDocumentFragment();
    next.forEach((n) => {
      const div = document.createElement("div");
      div.className = "detail__item";
      div.innerHTML = `<strong>${status}</strong> → <strong>${n}</strong>`;
      fragment.appendChild(div);
    });
    detailList.appendChild(fragment);
    qs(".detail__title")!.textContent = `状态：${status}`;
    qs(".detail__desc")!.textContent = descriptions[status] || "";
  };

  board?.addEventListener("click", (e) => {
    const target = e.target;
    const node = target instanceof HTMLElement ? target.closest(".flow-node") : null;
    if (!node || !node.dataset.status) return;
    nodes.forEach((n) => n.classList.toggle("active", n === node));
    renderDetail(node.dataset.status);
  });

  // 默认展示 open
  const defaultNode = qs('.flow-node[data-status="open"]');
  defaultNode?.classList.add("active");
  renderDetail("open");
})();

// 标签筛选演示
(() => {
  const tagContainer = qs("#filter-tags");
  const listContainer = qs("#ticket-list");
  const tags = [
    "Bug",
    "Feature",
    "Enhancement",
    "Documentation",
    "Question",
    "Critical",
    "Blocker",
    "Frontend",
    "Backend",
    "Database",
    "API",
    "UI/UX",
    "Needs Review",
    "In Testing",
    "Ready for Deploy",
    "On Hold",
  ];

  const tickets = [
    {
      title: "修复登录页面 Bug",
      desc: "移动端登录失败，需排查 API 与前端校验。",
      status: "open",
      priority: "high",
      tags: ["Bug", "API", "Frontend", "Needs Review"],
    },
    {
      title: "添加标签颜色配置",
      desc: "支持自定义标签颜色与图标库扩展。",
      status: "in_progress",
      priority: "medium",
      tags: ["Feature", "UI/UX", "Frontend"],
    },
    {
      title: "数据库索引优化",
      desc: "tickets 表分页查询新增组合索引，降低查询延迟。",
      status: "completed",
      priority: "high",
      tags: ["Enhancement", "Database", "Backend", "Ready for Deploy"],
    },
    {
      title: "完善 API 文档",
      desc: "对外 API 补充错误码、示例和速率限制说明。",
      status: "open",
      priority: "medium",
      tags: ["Documentation", "API", "On Hold"],
    },
    {
      title: "附件上传容量验证",
      desc: "后端增加 10MB 校验，前端提示友好错误。",
      status: "in_progress",
      priority: "high",
      tags: ["Bug", "Backend", "Frontend", "In Testing"],
    },
  ];

  const stateBadge = {
    open: "chip chip--gray",
    in_progress: "chip chip--blue",
    completed: "chip chip--yellow",
    cancelled: "chip",
  };

  const selected = new Set();

  const renderTags = () => {
    if (!tagContainer) return;
    tagContainer.innerHTML = "";
    tags.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = `filter-tag ${selected.has(t) ? "active" : ""}`;
      btn.textContent = t;
      btn.dataset.tag = t;
      tagContainer.appendChild(btn);
    });
  };

  const renderTickets = () => {
    if (!listContainer) return;
    listContainer.innerHTML = "";
    const filtered =
      selected.size === 0
        ? tickets
        : tickets.filter((t) => Array.from(selected).every((tag) => t.tags.includes(tag)));

    filtered.forEach((t) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card__head">
          <p class="card__title">${t.title}</p>
          <span class="${stateBadge[t.status] || "chip"}">${t.status}</span>
        </div>
        <p class="card__desc">${t.desc}</p>
        <div class="card__meta">
          ${t.tags
            .map((tag) => `<span class="chip chip--soft">${tag}</span>`)
            .join("")}
        </div>
      `;
      listContainer.appendChild(card);
    });
  };

  tagContainer?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.dataset.tag) return;
    const tag = target.dataset.tag;
    if (selected.has(tag)) selected.delete(tag);
    else selected.add(tag);
    renderTags();
    renderTickets();
  });

  renderTags();
  renderTickets();
})();

// FAQ 手风琴
(() => {
  const accordion = qs("#accordion");
  accordion?.addEventListener("click", (e) => {
    const trigger = e.target instanceof HTMLElement ? e.target.closest(".accordion__trigger") : null;
    if (!trigger) return;
    const item = trigger.parentElement;
    const panel = item?.querySelector(".accordion__panel");
    const icon = trigger.querySelector(".accordion__icon");
    const isOpen = panel?.classList.contains("open");

    qsa(".accordion__panel").forEach((p) => {
      p.classList.remove("open");
      p.style.maxHeight = "0px";
    });
    qsa(".accordion__icon").forEach((i) => (i.textContent = "+"));

    if (!isOpen && panel) {
      panel.classList.add("open");
      panel.style.maxHeight = `${panel.scrollHeight}px`;
      if (icon) icon.textContent = "−";
    }
  });
})();

// 英雄流转动效（点击步骤切换）
(() => {
  const steps = qsa(".flow__step");
  steps.forEach((step) => {
    step.setAttribute("role", "button");
    step.setAttribute("tabindex", "0");
    const toggle = () => {
      steps.forEach((s) => s.classList.remove("active"));
      step.classList.add("active");
    };
    step.addEventListener("click", toggle);
    step.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
})();

