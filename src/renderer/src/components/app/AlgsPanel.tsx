import { useState } from "react";
import { t, type TranslationKey } from "../../i18n";
import { AlgsSkillCardPanel } from "./AlgsSkillCardPanel";
import { AlgsTaskPanel } from "./AlgsTaskPanel";
import { AlgsLoraPanel } from "./AlgsLoraPanel";
import { FileText, Clock, BookOpen, Sparkles } from "lucide-react";

type TabType = "cards" | "tasks" | "lora";

const TABS: { id: TabType; labelKey: TranslationKey; icon: typeof FileText }[] = [
	{ id: "cards", labelKey: "algs.skillCards", icon: FileText },
	{ id: "tasks", labelKey: "algs.tasks", icon: Clock },
	{ id: "lora", labelKey: "algs.loraManagement", icon: BookOpen },
];

export function AlgsPanel() {
	const [activeTab, setActiveTab] = useState<TabType>("cards");

	return (
		<div className="algs-main-panel">
			<div className="algs-header">
				<div className="algs-brand">
					<Sparkles className="algs-brand-icon" aria-hidden="true" />
					<div className="algs-brand-text">
						<h2 className="algs-title">{t("algs.title")}</h2>
						<p className="algs-subtitle">{t("algs.subtitle")}</p>
					</div>
				</div>
			</div>

			<div className="algs-tabs">
				{TABS.map((tab) => {
					const Icon = tab.icon;
					return (
						<button
							key={tab.id}
							className={`algs-tab ${activeTab === tab.id ? "active" : ""}`}
							onClick={() => setActiveTab(tab.id)}
						>
							<Icon className="algs-tab-icon" aria-hidden="true" />
							<span>{t(tab.labelKey)}</span>
						</button>
					);
				})}
			</div>

			<div className="algs-content">
				{activeTab === "cards" && <AlgsSkillCardPanel />}
				{activeTab === "tasks" && <AlgsTaskPanel />}
				{activeTab === "lora" && <AlgsLoraPanel />}
			</div>
		</div>
	);
}
