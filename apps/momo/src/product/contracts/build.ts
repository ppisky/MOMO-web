import { record, text } from './core';

export const RESPONSE_SCHEMA = 'momo.responses/1.0';
export const CONTROL_SCHEMA = 'momo.control/1.0';
export type CoreBuild = { gitRevision: string; gitTag: string | null; dirty: boolean };
export type CoreIdentity = {
  packageVersion: string;
  build: CoreBuild | null;
  metadataAvailable: boolean;
};

export function coreIdentity(value: unknown): CoreIdentity {
  const v = record(value);
  const packageVersion = text(v.core_version, 'core_version');
  if (!/^1\.0\.0(?:-rc\.\d+)?$/.test(packageVersion)) throw new Error(`未验证的 Core 包版本：${packageVersion}`);
  if (v.response_schema !== undefined && v.response_schema !== RESPONSE_SCHEMA)
    throw new Error('Core 对话接口标准不兼容');
  if (v.control_schema !== undefined && v.control_schema !== CONTROL_SCHEMA)
    throw new Error('Core 控制接口标准不兼容');
  if (v.build_info === undefined) return { packageVersion, build: null, metadataAvailable: false };
  const build = record(v.build_info);
  if (build.git_revision === null && build.git_tag === null && build.dirty === null)
    return { packageVersion, build: null, metadataAvailable: true };
  const gitRevision = text(build.git_revision, 'git_revision');
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(gitRevision) || typeof build.dirty !== 'boolean')
    throw new Error('Core 构建信息无效');
  const gitTag = build.git_tag === null ? null : text(build.git_tag, 'git_tag');
  if (gitTag !== null && (!gitTag || gitTag.length > 256 || /[\x00-\x20\x7f]/.test(gitTag)))
    throw new Error('Core Git 标签无效');
  return { packageVersion, metadataAvailable: true, build: { gitRevision, gitTag, dirty: build.dirty } };
}

export function workspaceIdentity(value: unknown): CoreIdentity | null {
  if (value === null) return null;
  const v = record(value);
  const build = v.build === null ? null : record(v.build);
  if (typeof v.metadataAvailable !== 'boolean') throw new Error('Core 构建信息状态无效');
  if (!v.metadataAvailable && build) throw new Error('Core 构建信息状态冲突');
  return coreIdentity({
    core_version: v.packageVersion,
    ...(v.metadataAvailable ? { build_info: build ? {
      git_revision: build.gitRevision, git_tag: build.gitTag, dirty: build.dirty,
    } : { git_revision: null, git_tag: null, dirty: null } } : {}),
  });
}
