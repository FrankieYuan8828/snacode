import { useState, useEffect } from "react";
import { t, type TranslationKey } from "../../i18n";
import type { SnacodeDesktopApi } from "../../../../preload";
import { type LoRAMetadata, type TrainingJob, type TrainingConfig, type TaskType, type LoraBaseModel } from "../../../../shared/algs";

declare global {
	interface Window {
		snacodeDesktop: SnacodeDesktopApi;
	}
}
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Modal } from "../ui/Modal";
import { TextField } from "../ui/TextField";
import { Download, BookOpen, Train, Trash2, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

type TrainingJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export function AlgsLoraPanel() {
	const ipc = window.snacodeDesktop;
	const [loras, setLoras] = useState<LoRAMetadata[]>([]);
	const [jobs, setJobs] = useState<TrainingJob[]>([]);
	const [loading, setLoading] = useState(true);
	const [openDownloadModal, setOpenDownloadModal] = useState(false);
	const [openTrainModal, setOpenTrainModal] = useState(false);
	const [downloadUrl, setDownloadUrl] = useState("");
	const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
		taskType: "custom",
		datasetPath: "",
		baseModel: "custom",
		outputPath: "",
		epochs: 3,
		batchSize: 8,
		learningRate: 0.0001,
	});

	useEffect(() => {
		void loadLoras();
		void loadJobs();
	}, []);

	const loadLoras = async () => {
		setLoading(true);
		try {
			const result = await ipc.algs.getLoraList();
			setLoras(result);
		} catch (error) {
			console.error("Failed to load LoRA list:", error);
		}
		setLoading(false);
	};

	const loadJobs = async () => {
		try {
			const result = await ipc.algs.getTrainingJobs();
			setJobs(result);
		} catch (error) {
			console.error("Failed to load training jobs:", error);
		}
	};

	const handleDownload = async () => {
		if (!downloadUrl) return;

		try {
			await ipc.algs.downloadLora(downloadUrl);
			setOpenDownloadModal(false);
			setDownloadUrl("");
			void loadLoras();
		} catch (error) {
			console.error("Failed to download LoRA:", error);
		}
	};

	const handleTrain = async () => {
		if (!trainingConfig.datasetPath || !trainingConfig.baseModel) return;

		try {
			await ipc.algs.triggerTraining(trainingConfig);
			setOpenTrainModal(false);
			setTrainingConfig({
				taskType: "custom",
				datasetPath: "",
				baseModel: "custom",
				outputPath: "",
				epochs: 3,
				batchSize: 8,
				learningRate: 0.0001,
			});
			void loadJobs();
		} catch (error) {
			console.error("Failed to trigger training:", error);
		}
	};

	const handleDeleteLora = async (loraId: string) => {
		if (!confirm(t("algs.confirmDeleteLora"))) return;
		try {
			// TODO: Add delete method
			void loadLoras();
		} catch (error) {
			console.error("Failed to delete LoRA:", error);
		}
	};

	const getStatusIcon = (status: TrainingJobStatus) => {
		switch (status) {
			case "completed":
				return <CheckCircle className="status-icon status-icon-success" aria-hidden="true" />;
			case "failed":
				return <XCircle className="status-icon status-icon-error" aria-hidden="true" />;
			case "running":
				return <Loader2 className="status-icon status-icon-running" aria-hidden="true" />;
			default:
				return <Clock className="status-icon status-icon-pending" aria-hidden="true" />;
		}
	};

	const getStatusLabel = (status: TrainingJobStatus): TranslationKey => {
		const keys: Record<TrainingJobStatus, TranslationKey> = {
			pending: "algs.status.pending",
			running: "algs.status.running",
			completed: "algs.status.completed",
			failed: "algs.status.failed",
			cancelled: "algs.status.cancelled",
		};
		return keys[status];
	};

	return (
		<div className="algs-panel">
			<div className="algs-panel-header">
				<h3 className="algs-panel-title">
					<BookOpen className="algs-panel-icon" aria-hidden="true" />
					{t("algs.loraManagement")}
				</h3>
				<div className="algs-panel-actions">
					<Button variant="secondary" buttonSize="sm" onClick={() => setOpenDownloadModal(true)}>
						<Download className="inline-icon" aria-hidden="true" />
						{t("algs.downloadLora")}
					</Button>
					<Button variant="primary" buttonSize="sm" onClick={() => setOpenTrainModal(true)}>
						<Train className="inline-icon" aria-hidden="true" />
						{t("algs.newTraining")}
					</Button>
				</div>
			</div>

			<div className="algs-panel-content">
				{loading ? (
					<div className="config-loading">{t("common.loading")}</div>
				) : (
					<div className="lora-tabs">
						<div className="lora-tab active">
							<span>{t("algs.loraFiles")}</span>
							<span className="tab-count">{loras.length}</span>
						</div>
						<div className="lora-tab">
							<span>{t("algs.trainingJobs")}</span>
							<span className="tab-count">{jobs.length}</span>
						</div>
					</div>
				)}

				<div className="lora-content">
					{/* LoRA Files */}
					{loading ? (
						<div className="config-loading">{t("common.loading")}</div>
					) : loras.length === 0 ? (
						<div className="config-empty">
							<BookOpen className="empty-icon" aria-hidden="true" />
							<p>{t("algs.noLoraFiles")}</p>
							<Button variant="ghost" onClick={() => setOpenDownloadModal(true)}>
								{t("algs.downloadFirstLora")}
							</Button>
						</div>
					) : (
						<div className="lora-list">
							{loras.map((lora) => (
								<div key={lora.id} className="lora-item">
									<div className="lora-info">
										<div className="lora-header">
											<span className="lora-name">{lora.name}</span>
											<span className="lora-model">{lora.baseModel}</span>
										</div>
										<p className="lora-description">{lora.description}</p>
										<div className="lora-meta">
											<span className="lora-size">{lora.fileSize}</span>
											<span className="lora-date">{new Date(lora.createdAt).toLocaleDateString()}</span>
										</div>
									</div>
									<div className="lora-actions">
										<IconButton label={t("common.delete")} onClick={() => handleDeleteLora(lora.id)} className="ui-icon-button-danger">
											<Trash2 aria-hidden="true" />
										</IconButton>
									</div>
								</div>
							))}
						</div>
					)}

					{/* Training Jobs */}
					<div className="training-section">
						<h4>{t("algs.recentTrainingJobs")}</h4>
						{jobs.length === 0 ? (
							<div className="config-empty small">
								<Clock className="empty-icon" aria-hidden="true" />
								<p>{t("algs.noTrainingJobs")}</p>
							</div>
						) : (
							<div className="training-jobs">
								{jobs.slice(0, 5).map((job) => (
									<div key={job.id} className="training-job">
										<div className="training-status">
											{getStatusIcon(job.status as TrainingJobStatus)}
											<span>{t(getStatusLabel(job.status as TrainingJobStatus))}</span>
										</div>
										<div className="training-info">
											<span className="training-task">{job.taskType}</span>
											<span className="training-model">{job.baseModel}</span>
											<span className="training-progress">{job.progress}%</span>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Download Modal */}
			<Modal open={openDownloadModal} onClose={() => setOpenDownloadModal(false)} title={t("algs.downloadLora")}>
				<div className="algs-form">
					<TextField
						label={t("algs.loraUrl")}
						value={downloadUrl}
						onChange={(value) => setDownloadUrl(value)}
						placeholder={t("algs.loraUrlPlaceholder")}
					/>

					<div className="algs-form-actions">
						<Button variant="ghost" onClick={() => setOpenDownloadModal(false)}>
							{t("common.cancel")}
						</Button>
						<Button variant="primary" onClick={handleDownload} disabled={!downloadUrl}>
							{t("algs.download")}
						</Button>
					</div>
				</div>
			</Modal>

			{/* Training Modal */}
			<Modal open={openTrainModal} onClose={() => setOpenTrainModal(false)} title={t("algs.newTraining")}>
				<div className="algs-form">
					<TextField
						label={t("algs.taskType")}
						value={trainingConfig.taskType}
						onChange={(value) => setTrainingConfig({ ...trainingConfig, taskType: value as TaskType })}
						placeholder={t("algs.taskTypePlaceholder")}
					/>

					<TextField
						label={t("algs.datasetPath")}
						value={trainingConfig.datasetPath}
						onChange={(value) => setTrainingConfig({ ...trainingConfig, datasetPath: value })}
						placeholder={t("algs.datasetPathPlaceholder")}
					/>

					<TextField
						label={t("algs.baseModel")}
						value={trainingConfig.baseModel}
						onChange={(value) => setTrainingConfig({ ...trainingConfig, baseModel: value as LoraBaseModel })}
						placeholder={t("algs.baseModelPlaceholder")}
					/>

					<div className="algs-form-row">
						<TextField
							label={t("algs.epochs")}
							type="number"
							value={trainingConfig.epochs.toString()}
							onChange={(value) => setTrainingConfig({ ...trainingConfig, epochs: parseInt(value) || 3 })}
						/>
						<TextField
							label={t("algs.batchSize")}
							type="number"
							value={trainingConfig.batchSize.toString()}
							onChange={(value) => setTrainingConfig({ ...trainingConfig, batchSize: parseInt(value) || 8 })}
						/>
						<TextField
							label={t("algs.learningRate")}
							type="number"
							value={trainingConfig.learningRate.toString()}
							onChange={(value) => setTrainingConfig({ ...trainingConfig, learningRate: parseFloat(value) || 0.0001 })}
						/>
					</div>

					<div className="algs-form-actions">
						<Button variant="ghost" onClick={() => setOpenTrainModal(false)}>
							{t("common.cancel")}
						</Button>
						<Button variant="primary" onClick={handleTrain} disabled={!trainingConfig.datasetPath || !trainingConfig.baseModel}>
							{t("algs.startTraining")}
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
