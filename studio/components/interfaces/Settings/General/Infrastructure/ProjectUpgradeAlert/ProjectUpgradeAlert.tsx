import Link from 'next/link'
import { useRouter } from 'next/router'
import { FC, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Modal,
  IconPackage,
  Listbox,
  IconAlertCircle,
  IconExternalLink,
} from 'ui'

import { useParams, useStore } from 'hooks'
import { post } from 'lib/common/fetch'
import { API_ADMIN_URL, PROJECT_STATUS } from 'lib/constants'
import InformationBox from 'components/ui/InformationBox'
import { BREAKING_CHANGES } from './ProjectUpgradeAlert.constants'
import { useProjectUpgradeEligibilityQuery } from 'data/config/project-upgrade-eligibility-query'

interface Props {}

const ProjectUpgradeAlert: FC<Props> = ({}) => {
  const router = useRouter()
  const { app, ui } = useStore()
  const { ref } = useParams()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const formId = 'project-upgrade-form'
  const { data } = useProjectUpgradeEligibilityQuery({ projectRef: ref })
  const currentPgVersion = (data?.current_app_version ?? '').split('supabase-postgres-')[1]
  const latestPgVersion = (data?.latest_app_version ?? '').split('supabase-postgres-')[1]

  const initialValues = { version: data?.target_upgrade_versions?.[0]?.postgres_version ?? 0 }

  const onConfirmUpgrade = async (values: any, { setSubmitting }: any) => {
    setSubmitting(true)

    const res = await post(`${API_ADMIN_URL}/projects/${ref}/upgrade`, {
      target_version: values.version,
    })
    if (res.error) {
      ui.setNotification({
        category: 'error',
        error: res.error,
        message: `Failed to upgrade: ${res.error.message}`,
      })
      setSubmitting(false)
    } else {
      const projectId = ui.selectedProject?.id
      if (projectId !== undefined) {
        app.onProjectStatusUpdated(projectId, PROJECT_STATUS.UPGRADING)
        ui.setNotification({ category: 'success', message: 'Upgrading project' })
        router.push(`/project/${ref}?upgradeInitiated=true`)
      }
    }
  }

  return (
    <>
      <Alert
        icon={<IconPackage className="text-brand-900" strokeWidth={1.5} />}
        variant="success"
        title="Your project can be upgraded to the latest version of Postgres"
      >
        <p className="mb-3">
          The latest version of Postgres ({latestPgVersion}) is available for your project.
        </p>
        <Button size="tiny" type="primary" onClick={() => setShowUpgradeModal(true)}>
          Upgrade project
        </Button>
      </Alert>
      <Modal
        hideFooter
        visible={showUpgradeModal}
        onCancel={() => setShowUpgradeModal(false)}
        header={<h3>Upgrade Postgres</h3>}
      >
        <Form id={formId} initialValues={initialValues} onSubmit={onConfirmUpgrade}>
          {({ values, isSubmitting }: { values: any; isSubmitting: boolean }) => {
            const selectedVersion = (data?.target_upgrade_versions ?? []).find(
              (x) => x.postgres_version === values.version
            )

            return (
              <>
                <div className="py-6">
                  <Modal.Content>
                    <div className="space-y-4">
                      <p className="text-sm">
                        All services, including Auth, Rest, and Extensions will be upgraded. This
                        action cannot be undone.
                      </p>
                      {(data?.potential_breaking_changes ?? []).length > 0 && (
                        <InformationBox
                          icon={<IconAlertCircle strokeWidth={2} />}
                          title="There will be breaking changes involved with the upgrade"
                          description={
                            <ul className="list-disc pl-4">
                              {data?.potential_breaking_changes.map((reason) => {
                                const change = (BREAKING_CHANGES as any)[reason]
                                if (change !== undefined)
                                  return (
                                    <li key={reason}>
                                      <p className="text-scale-1200">{change.title}</p>
                                      <p className="flex items-center space-x-1">
                                        <span>This update has breaking changes. Read more </span>
                                        <Link href={change.url}>
                                          <a className="text-brand-900 opacity-90 flex items-center space-x-1">
                                            <span>here</span>
                                            <IconExternalLink size="tiny" strokeWidth={2} />
                                          </a>
                                        </Link>
                                      </p>
                                    </li>
                                  )
                                else return null
                              })}
                            </ul>
                          }
                        />
                      )}
                      <Alert
                        withIcon
                        variant="warning"
                        title="Your project will be offline while the upgrade is in progress"
                      >
                        Upgrades will take a few minutes depending on the size of your database. It
                        is advised to upgrade at a time when there will be minimal impact for your
                        application
                      </Alert>
                      <Listbox
                        id="version"
                        name="version"
                        label="Select the version of Postgres to upgrade to"
                        descriptionText={`Postgres will be upgraded from ${currentPgVersion} to ${
                          selectedVersion?.app_version?.split('supabase-postgres-')[1] ??
                          values.version
                        }`}
                      >
                        {data?.target_upgrade_versions.map((version) => (
                          <Listbox.Option
                            key={version.postgres_version}
                            value={version.postgres_version}
                            label={`${version.postgres_version} (${
                              version.app_version.split('supabase-postgres-')[1]
                            })`}
                          >
                            {version.postgres_version} (
                            {version.app_version.split('supabase-postgres-')[1]})
                          </Listbox.Option>
                        ))}
                      </Listbox>
                    </div>
                  </Modal.Content>
                </div>
                <div className="flex items-center space-x-2 justify-end px-4 py-4 border-t">
                  <Button
                    type="default"
                    onClick={() => setShowUpgradeModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button htmlType="submit" disabled={isSubmitting} loading={isSubmitting}>
                    Confirm upgrade
                  </Button>
                </div>
              </>
            )
          }}
        </Form>
      </Modal>
    </>
  )
}

export default ProjectUpgradeAlert
