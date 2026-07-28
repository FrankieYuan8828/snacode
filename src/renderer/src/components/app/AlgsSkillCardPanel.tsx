import { useState, useEffect } from "react";
import { t } from "../../i18n";
import type { SnacodeDesktopApi } from "../../../../preload";
import { type SkillCard, type TaskType } from "../../../../shared/algs";

declare global {
	interface Window {
		snacodeDesktop: SnacodeDesktopApi;
	}
}
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Modal } from "../ui/Modal";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { FileText, Plus, Edit, Trash2 } from "lucide-react";

const TASK_TYPES: { value: TaskType; label: string }[] = [
	{ value: "code_generation", label: "代码生成" },
	{ value: "code_review", label: "代码审查" },
	{ value: "documentation", label: "文档编写" },
	{ value: "test_generation", label: "测试生成" },
	{ value: "refactoring", label: "代码重构" },
	{ value: "analysis", label: "代码分析" },
	{ value: "custom", label: "自定义" },
];

export function AlgsSkillCardPanel() {
	const ipc = window.snacodeDesktop;
	const [cards, setCards] = useState<SkillCard[]>([]);
	const [loading, setLoading] = useState(true);
	const [openModal, setOpenModal] = useState(false);
	const [editingCard, setEditingCard] = useState<SkillCard | null>(null);
	const [newCard, setNewCard] = useState<Partial<SkillCard>>({
		name: "",
		description: "",
		taskType: "code_generation",
		systemPrompt: "",
		parameters: {},
	});

	useEffect(() => {
		void loadCards();
	}, []);

	const loadCards = async () => {
		setLoading(true);
		try {
			const result = await ipc.algs.getSkillCards();
			setCards(result);
		} catch (error) {
			console.error("Failed to load skill cards:", error);
		}
		setLoading(false);
	};

	const handleSaveCard = async () => {
		if (!newCard.name || !newCard.systemPrompt) return;

		try {
			const card: SkillCard = {
				...newCard,
				id: editingCard?.id || crypto.randomUUID(),
				name: newCard.name,
				description: newCard.description || "",
				taskType: newCard.taskType as TaskType,
				systemPrompt: newCard.systemPrompt,
				parameters: newCard.parameters || {},
				version: editingCard?.version || 1,
				createdAt: editingCard?.createdAt || new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			await ipc.algs.saveSkillCard(card);
			setOpenModal(false);
			setEditingCard(null);
			setNewCard({
				name: "",
				description: "",
				taskType: "code_generation",
				systemPrompt: "",
				parameters: {},
			});
			void loadCards();
		} catch (error) {
			console.error("Failed to save skill card:", error);
		}
	};

	const handleDeleteCard = async (id: string) => {
		if (!confirm(t("algs.confirmDelete"))) return;
		try {
			await ipc.algs.deleteSkillCard(id);
			void loadCards();
		} catch (error) {
			console.error("Failed to delete skill card:", error);
		}
	};

	const handleEditCard = (card: SkillCard) => {
		setEditingCard(card);
		setNewCard({
			name: card.name,
			description: card.description,
			taskType: card.taskType,
			systemPrompt: card.systemPrompt,
			fewShotExamples: card.fewShotExamples,
			loraPath: card.loraPath,
			parameters: card.parameters,
		});
		setOpenModal(true);
	};

	const handleAddCard = () => {
		setEditingCard(null);
		setNewCard({
			name: "",
			description: "",
			taskType: "code_generation",
			systemPrompt: "",
			parameters: {},
		});
		setOpenModal(true);
	};

	return (
		<div className="algs-panel">
			<div className="algs-panel-header">
				<h3 className="algs-panel-title">
					<FileText className="algs-panel-icon" aria-hidden="true" />
					{t("algs.skillCards")}
				</h3>
				<Button variant="primary" buttonSize="sm" onClick={handleAddCard}>
					<Plus className="inline-icon" aria-hidden="true" />
					{t("algs.addCard")}
				</Button>
			</div>

			<div className="algs-panel-content">
				{loading ? (
					<div className="config-loading">{t("common.loading")}</div>
				) : cards.length === 0 ? (
					<div className="config-empty">
						<FileText className="empty-icon" aria-hidden="true" />
						<p>{t("algs.noSkillCards")}</p>
						<Button variant="ghost" onClick={handleAddCard}>
							{t("algs.createFirstCard")}
						</Button>
					</div>
				) : (
					<div className="skill-card-list">
						{cards.map((card) => (
							<div key={card.id} className="skill-card-item">
								<div className="skill-card-info">
									<div className="skill-card-header">
										<span className="skill-card-name">{card.name}</span>
										<span className="skill-card-type">{TASK_TYPES.find((t) => t.value === card.taskType)?.label || card.taskType}</span>
									</div>
									<p className="skill-card-description">{card.description}</p>
									<div className="skill-card-meta">
										<span className="skill-card-version">v{card.version}</span>
										<span className="skill-card-date">{new Date(card.updatedAt).toLocaleDateString()}</span>
									</div>
								</div>
								<div className="skill-card-actions">
									<IconButton label={t("common.edit")} onClick={() => handleEditCard(card)}>
										<Edit aria-hidden="true" />
									</IconButton>
									<IconButton label={t("common.delete")} onClick={() => handleDeleteCard(card.id)} className="ui-icon-button-danger">
										<Trash2 aria-hidden="true" />
									</IconButton>
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<Modal
				open={openModal}
				onClose={() => {
					setOpenModal(false);
					setEditingCard(null);
				}}
				title={editingCard ? t("algs.editCard") : t("algs.createCard")}
			>
				<div className="algs-form">
					<TextField
						label={t("algs.cardName")}
						value={newCard.name || ""}
						onChange={(value) => setNewCard({ ...newCard, name: value })}
						placeholder={t("algs.cardNamePlaceholder")}
					/>

					<SelectField
						label={t("algs.taskType")}
						value={newCard.taskType || "code_generation"}
						options={TASK_TYPES}
						onChange={(value) => setNewCard({ ...newCard, taskType: value as TaskType })}
					/>

					<TextField
						label={t("algs.description")}
						value={newCard.description || ""}
						onChange={(value) => setNewCard({ ...newCard, description: value })}
						placeholder={t("algs.descriptionPlaceholder")}
					/>

					<TextField
						label={t("algs.systemPrompt")}
						value={newCard.systemPrompt || ""}
						onChange={(value) => setNewCard({ ...newCard, systemPrompt: value })}
						placeholder={t("algs.systemPromptPlaceholder")}
					/>

					<TextField
						label={t("algs.loraPath")}
						value={newCard.loraPath || ""}
						onChange={(value) => setNewCard({ ...newCard, loraPath: value })}
						placeholder={t("algs.loraPathPlaceholder")}
					/>

					<div className="algs-form-actions">
						<Button variant="ghost" onClick={() => setOpenModal(false)}>
							{t("common.cancel")}
						</Button>
						<Button variant="primary" onClick={handleSaveCard} disabled={!newCard.name || !newCard.systemPrompt}>
							{t("common.save")}
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
