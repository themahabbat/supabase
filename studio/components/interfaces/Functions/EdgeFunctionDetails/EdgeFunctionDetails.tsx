import dayjs from 'dayjs'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { FC, useState, useEffect } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { PermissionAction } from '@supabase/shared-types/out/constants'
import {
  Alert,
  IconTerminal,
  IconMinimize2,
  IconMaximize2,
  Button,
  Modal,
  Form,
  Toggle,
  Input,
  IconExternalLink,
} from 'ui'

import { useStore, useParams, checkPermissions } from 'hooks'
import Panel from 'components/ui/Panel'
import CommandRender from '../CommandRender'
import { generateCLICommands } from './EdgeFunctionDetails.utils'
import { useProjectApiQuery } from 'data/config/project-api-query'
import { useEdgeFunctionUpdateMutation } from 'data/edge-functions/edge-functions-update-mutation'
import { useEdgeFunctionDeleteMutation } from 'data/edge-functions/edge-functions-delete-mutation'
import {
  FormHeader,
  FormPanel,
  FormActions,
  FormSection,
  FormSectionLabel,
  FormSectionContent,
} from 'components/ui/Forms'
import { useEdgeFunctionQuery } from 'data/edge-functions/edge-function-query'
import clsx from 'clsx'

interface Props {}

const EdgeFunctionDetails: FC<Props> = () => {
  const router = useRouter()
  const { ui } = useStore()
  const { ref: projectRef, functionSlug } = useParams()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  const { data: settings } = useProjectApiQuery({ projectRef })
  const { data: selectedFunction } = useEdgeFunctionQuery({ projectRef, slug: functionSlug })
  const { mutateAsync: updateEdgeFunction } = useEdgeFunctionUpdateMutation()
  const { mutateAsync: deleteEdgeFunction, isLoading: isDeleting } = useEdgeFunctionDeleteMutation()

  const formId = 'edge-function-update-form'
  const canUpdateEdgeFunction = checkPermissions(PermissionAction.FUNCTIONS_WRITE, '*')

  // Get the API service
  const apiService = settings?.autoApiService
  const anonKey = apiService?.service_api_keys.find((x) => x.name === 'anon key')
    ? apiService.defaultApiKey
    : '[YOUR ANON KEY]'

  const endpoint = apiService?.app_config.endpoint ?? ''
  const endpointSections = endpoint.split('.')
  const functionsEndpoint = [
    ...endpointSections.slice(0, 1),
    'functions',
    ...endpointSections.slice(1),
  ].join('.')
  const functionUrl = `${apiService?.protocol}://${functionsEndpoint}/${selectedFunction?.slug}`

  const { managementCommands, secretCommands, invokeCommands } = generateCLICommands(
    selectedFunction,
    functionUrl,
    anonKey
  )

  const onUpdateFunction = async (values: any, { setSubmitting, resetForm }: any) => {
    if (!projectRef) return console.error('Project ref is required')
    if (selectedFunction === undefined) return console.error('No edge function selected')
    setSubmitting(true)

    try {
      await updateEdgeFunction({
        projectRef,
        slug: selectedFunction.slug,
        payload: values,
      })
      resetForm({ values, initialValues: values })
      ui.setNotification({ category: 'success', message: `Successfully updated edge function` })
    } catch (error: any) {
      ui.setNotification({
        category: 'error',
        message: `Failed to update edge function: ${error.message}`,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onConfirmDelete = async () => {
    if (!projectRef) return console.error('Project ref is required')
    if (selectedFunction === undefined) return console.error('No edge function selected')

    try {
      await deleteEdgeFunction({ projectRef, slug: selectedFunction.slug })
      ui.setNotification({
        category: 'success',
        message: `Successfully deleted "${selectedFunction.name}"`,
      })
      router.push(`/project/${projectRef}/functions`)
    } catch (error: any) {
      ui.setNotification({
        category: 'error',
        message: `Failed to delete function: ${error.message}`,
      })
    }
  }

  return (
    <>
      <div className="space-y-4 pb-16">
        <Form id={formId} initialValues={{}} onSubmit={onUpdateFunction}>
          {({ isSubmitting, handleReset, values, initialValues, resetForm }: any) => {
            const hasChanges = JSON.stringify(values) !== JSON.stringify(initialValues)

            useEffect(() => {
              if (selectedFunction !== undefined) {
                const formValues = {
                  name: selectedFunction?.name,
                  verify_jwt: selectedFunction?.verify_jwt,
                }
                resetForm({ values: formValues, initialValues: formValues })
              }
            }, [selectedFunction])
            return (
              <>
                <FormPanel
                  disabled={!canUpdateEdgeFunction}
                  footer={
                    <div className="flex py-4 px-8">
                      <FormActions
                        form={formId}
                        isSubmitting={isSubmitting}
                        hasChanges={hasChanges}
                        handleReset={handleReset}
                        helper={
                          !canUpdateEdgeFunction
                            ? 'You need additional permissions to update this function'
                            : undefined
                        }
                      />
                    </div>
                  }
                >
                  <FormSection header={<FormSectionLabel>Function Details</FormSectionLabel>}>
                    <FormSectionContent loading={selectedFunction === undefined}>
                      <Input id="name" name="name" label="Name" />
                      <Input
                        disabled
                        id="slug"
                        name="slug"
                        label="Slug"
                        value={selectedFunction?.slug}
                      />
                      <Input disabled copy label="Endpoint URL" value={functionUrl} />
                      <Input disabled label="Region" value="All functions are deployed globally" />
                      <Input
                        disabled
                        label="Created at"
                        value={dayjs(selectedFunction?.created_at ?? 0).format(
                          'dddd, MMMM D, YYYY h:mm A'
                        )}
                      />
                      <Input
                        disabled
                        label="Last updated at"
                        value={dayjs(selectedFunction?.updated_at ?? 0).format(
                          'dddd, MMMM D, YYYY h:mm A'
                        )}
                      />
                      <Input disabled label="Deployments" value={selectedFunction?.version ?? 0} />
                    </FormSectionContent>
                  </FormSection>
                  <FormSection header={<FormSectionLabel>Function Configuration</FormSectionLabel>}>
                    <FormSectionContent loading={selectedFunction === undefined}>
                      <Toggle
                        id="verify_jwt"
                        name="verify_jwt"
                        label="Enforce JWT Verification"
                        descriptionText="Require a valid JWT in the authorization header when invoking the function"
                      />
                      <div className="space-y-1 border rounded border-scale-500 bg-scale-400 px-4 py-4">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm">
                            Import maps are{' '}
                            <span
                              className={clsx(
                                selectedFunction?.import_map ? 'text-brand-900' : 'text-amber-900'
                              )}
                            >
                              {selectedFunction?.import_map ? 'allowed' : 'disallowed'}
                            </span>{' '}
                            for this function
                          </p>
                        </div>
                        <p className="text-sm text-scale-1000">
                          Import maps allow the use of bare specifiers without having to install the
                          Node.js package locally
                        </p>
                        <div className="!mt-4">
                          <Link href="https://supabase.com/docs/guides/functions/import-maps">
                            <a target="_blank">
                              <Button type="default" icon={<IconExternalLink strokeWidth={1.5} />}>
                                More about import maps
                              </Button>
                            </a>
                          </Link>
                        </div>
                      </div>
                    </FormSectionContent>
                  </FormSection>
                </FormPanel>
              </>
            )
          }}
        </Form>

        <div
          className="space-y-6 rounded border bg-scale-100 px-6 py-4 drop-shadow-sm dark:bg-scale-300 transition-all overflow-hidden"
          style={{ maxHeight: showInstructions ? 800 : 66 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded border bg-scale-1200 p-2 text-scale-100 dark:bg-scale-100 dark:text-scale-1200">
                <IconTerminal strokeWidth={2} />
              </div>
              <h4>Command line access</h4>
            </div>
            <div className="cursor-pointer" onClick={() => setShowInstructions(!showInstructions)}>
              {showInstructions ? (
                <IconMinimize2 size={14} strokeWidth={1.5} />
              ) : (
                <IconMaximize2 size={14} strokeWidth={1.5} />
              )}
            </div>
          </div>

          <h5 className="text-base">Deployment management</h5>
          <CommandRender commands={managementCommands} />
          <h5 className="text-base">Invoke </h5>
          <CommandRender commands={invokeCommands} />
          <h5 className="text-base">Secrets management</h5>
          <CommandRender commands={secretCommands} />
        </div>

        <div className="!mt-8">
          <FormHeader title="Delete Edge Function" description="" />
          <Panel>
            <Panel.Content>
              <Alert
                withIcon
                variant="danger"
                title="Once your function is deleted, it can no longer be restored"
              >
                <p className="mb-3">
                  Make sure you have made a backup if you want to restore your edge function
                </p>
                <Tooltip.Root delayDuration={0}>
                  <Tooltip.Trigger>
                    <Button
                      type="danger"
                      disabled={!canUpdateEdgeFunction}
                      loading={selectedFunction?.id === undefined}
                      onClick={() => setShowDeleteModal(true)}
                    >
                      Delete edge function
                    </Button>
                  </Tooltip.Trigger>
                  {!canUpdateEdgeFunction && (
                    <Tooltip.Portal>
                      <Tooltip.Content side="bottom">
                        <Tooltip.Arrow className="radix-tooltip-arrow" />
                        <div
                          className={[
                            'rounded bg-scale-100 py-1 px-2 leading-none shadow',
                            'border border-scale-200',
                          ].join(' ')}
                        >
                          <span className="text-xs text-scale-1200">
                            You need additional permissions to delete an edge function
                          </span>
                        </div>
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  )}
                </Tooltip.Root>
              </Alert>
            </Panel.Content>
          </Panel>
        </div>
      </div>

      <Modal
        size="small"
        alignFooter="right"
        header={<h3>Confirm to delete {selectedFunction?.name}</h3>}
        visible={showDeleteModal}
        loading={isDeleting}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={onConfirmDelete}
      >
        <div className="py-6">
          <Modal.Content>
            <Alert withIcon variant="warning" title="This action cannot be undone">
              Ensure that you have made a backup if you want to restore your edge function
            </Alert>
          </Modal.Content>
        </div>
      </Modal>
    </>
  )
}

export default EdgeFunctionDetails
